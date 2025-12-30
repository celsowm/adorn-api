import ts from "typescript";
import type { ScannedController, ScannedOperation, ScannedParameter } from "../analyze/scanControllers.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";
import type { SchemaContext, JsonSchema } from "./typeToJsonSchema.js";

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
  const ctx: SchemaContext = { checker, components };

  const paths: Record<string, Record<string, any>> = {};

  for (const controller of controllers) {
    for (const operation of controller.operations) {
      const fullPath = convertToOpenApiPath(controller.basePath, operation.path);

      if (!paths[fullPath]) {
        paths[fullPath] = {};
      }

      const method = operation.httpMethod.toLowerCase();
      paths[fullPath][method] = buildOperation(operation, ctx);
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
  return base + converted || "/";
}

function buildOperation(operation: ScannedOperation, ctx: SchemaContext): any {
  const op: any = {
    operationId: operation.operationId,
    responses: {},
  };

  const parameters: any[] = [];

  buildPathParameters(operation, ctx, parameters);
  buildQueryParameters(operation, ctx, parameters);
  buildHeaderParameters(operation, ctx, parameters);

  if (parameters.length > 0) {
    op.parameters = parameters;
  }

  const responseSchema = typeToJsonSchema(operation.returnType, ctx);

  const status = operation.httpMethod === "POST" ? 201 : 200;
  op.responses[status] = {
    description: status === 201 ? "Created" : "OK",
    content: {
      "application/json": {
        schema: responseSchema,
      },
    },
  };

  if (["POST", "PUT", "PATCH"].includes(operation.httpMethod)) {
    const bodyParam = operation.parameters.find(p => p.index === 0);
    if (bodyParam) {
      const bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      op.requestBody = {
        required: !bodyParam.isOptional,
        content: {
          "application/json": {
            schema: bodySchema,
          },
        },
      };
    }
  }

  return op;
}

function buildPathParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  for (const paramName of operation.pathParams) {
    const param = operation.parameters.find(p => p.name === paramName);
    if (param) {
      const paramSchema = typeToJsonSchema(param.type, ctx);
      parameters.push({
        name: paramName,
        in: "path",
        required: !param.isOptional,
        schema: paramSchema.$ref
          ? { type: "string", $ref: paramSchema.$ref }
          : paramSchema,
      });
    }
  }
}

function buildQueryParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  if (!operation.queryParamName) return;

  const queryParam = operation.parameters.find(p => p.name === operation.queryParamName);
  if (!queryParam) return;

  const querySchema = typeToJsonSchema(queryParam.type, ctx);
  if (!querySchema.properties) return;

  const queryObjProps = querySchema.properties;
  for (const [propName, propSchema] of Object.entries(queryObjProps as Record<string, any>)) {
    const isRequired = querySchema.required?.includes(propName) ?? false;
    parameters.push({
      name: propName,
      in: "query",
      required: isRequired,
      schema: propSchema,
    });
  }
}

function buildHeaderParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  if (!operation.headerParamName) return;

  const headerParam = operation.parameters.find(p => p.name === operation.headerParamName);
  if (!headerParam) return;

  const headerSchema = typeToJsonSchema(headerParam.type, ctx);
  if (!headerSchema.properties) return;

  const headerObjProps = headerSchema.properties;
  for (const [propName, propSchema] of Object.entries(headerObjProps as Record<string, any>)) {
    const isRequired = headerSchema.required?.includes(propName) ?? false;
    parameters.push({
      name: propName,
      in: "header",
      required: isRequired,
      schema: propSchema,
    });
  }
}

function joinPaths(base: string, sub: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const s = sub.startsWith("/") ? sub : `/${sub}`;
  return b + s || "/";
}
