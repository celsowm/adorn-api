import ts from "typescript";
import type { ScannedController, ScannedOperation, ScannedParameter } from "../analyze/scanControllers.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";
import { extractPropertySchemaFragments, mergeFragments } from "./extractAnnotations.js";
import type { SchemaContext, JsonSchema } from "./types.js";
import {
  buildPathParameters,
  buildQueryParameters,
  buildHeaderParameters,
  buildCookieParameters,
  resolveSchemaRef,
} from "./parameters.js";

export interface OpenAPI31 {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
  };
  components: {
    schemas: Record<string, JsonSchema>;
  };
  paths: Record<string, Record<string, any>>;
}

export function generateOpenAPI(
  controllers: ScannedController[],
  checker: ts.TypeChecker,
  options: { title?: string; version?: string } = {}
): OpenAPI31 {
  const components = new Map<string, JsonSchema>();
  const ctx: SchemaContext = {
    checker,
    components,
    typeStack: new Set(),
    typeNameStack: [],
    mode: "response",
  };

  const paths: Record<string, Record<string, any>> = {};

  for (const controller of controllers) {
    for (const operation of controller.operations) {
      const fullPath = convertToOpenApiPath(controller.basePath, operation.path);

      if (!paths[fullPath]) {
        paths[fullPath] = {};
      }

      const method = operation.httpMethod.toLowerCase();
      paths[fullPath][method] = buildOperation(operation, ctx, controller.consumes);
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "API",
      version: options.version ?? "1.0.0",
    },
    components: {
      schemas: Object.fromEntries(components),
    },
    paths,
  };
}

function convertToOpenApiPath(basePath: string, path: string): string {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const converted = path.replace(/:([^/]+)/g, "{$1}");
  let fullPath = base + converted || "/";
  
  if (fullPath.endsWith("/") && fullPath !== "/") {
    fullPath = fullPath.slice(0, -1);
  }
  
  return fullPath;
}

function buildOperation(operation: ScannedOperation, ctx: SchemaContext, controllerConsumes?: string[]): any {
  const op: any = {
    operationId: operation.operationId,
    responses: {},
  };

  const parameters: any[] = [];

  buildPathParameters(operation, ctx, parameters);
  buildQueryParameters(operation, ctx, parameters);
  buildHeaderParameters(operation, ctx, parameters);
  buildCookieParameters(operation, ctx, parameters);

  if (parameters.length > 0) {
    op.parameters = parameters;
  }

  const responseCtx = { ...ctx, mode: "response" as const };
  const responseSchema = typeToJsonSchema(operation.returnType, responseCtx, operation.returnTypeNode);

  const status = operation.httpMethod === "POST" ? 201 : 200;
  op.responses[status] = {
    description: status === 201 ? "Created" : "OK",
    content: {
      "application/json": {
        schema: responseSchema,
      },
    },
  };

  if (["POST", "PUT", "PATCH"].includes(operation.httpMethod) && operation.bodyParamIndex !== null) {
    const bodyParam = operation.parameters[operation.bodyParamIndex];
    if (bodyParam) {
      const requestCtx = { ...ctx, mode: "request" as const };
      let bodySchema = typeToJsonSchema(bodyParam.type, requestCtx);
      bodySchema = mergeBodySchemaAnnotations(bodyParam, requestCtx, bodySchema);

      const contentType = operation.bodyContentType ?? controllerConsumes?.[0] ?? "application/json";

      const requestBody: any = {
        required: !bodyParam.isOptional,
        content: {},
      };

      if (contentType === "multipart/form-data") {
        requestBody.content["multipart/form-data"] = {
          schema: bodySchema,
        };
      } else {
        requestBody.content[contentType] = {
          schema: bodySchema,
        };
      }

      op.requestBody = requestBody;
    }
  }

  return op;
}

function mergeBodySchemaAnnotations(
  bodyParam: ScannedParameter,
  ctx: SchemaContext,
  schema: JsonSchema
): JsonSchema {
  if (!schema.properties) return schema;

  const typeSymbol = bodyParam.type.getSymbol();
  if (!typeSymbol) return schema;

  const declarations = typeSymbol.getDeclarations();
  if (!declarations || declarations.length === 0) return schema;

  const classDecl = declarations[0];
  if (!ts.isClassDeclaration(classDecl)) return schema;

  const result = { ...schema };
  const props = { ...result.properties as Record<string, JsonSchema> };

  for (const member of classDecl.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name) continue;

    const propName = ts.isIdentifier(member.name) ? member.name.text : null;
    if (!propName) continue;
    if (!props[propName]) continue;

    const frags = extractPropertySchemaFragments(ctx.checker, member);
    if (frags.length > 0) {
      props[propName] = mergeFragments(props[propName] as Record<string, unknown>, ...frags) as JsonSchema;
    }
  }

  result.properties = props;
  return result;
}
