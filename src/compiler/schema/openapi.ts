import ts from "typescript";
import type { ScannedController, ScannedOperation, ScannedParameter } from "../analyze/scanControllers.js";
import { typeToJsonSchema, createSchemaContext } from "./typeToJsonSchema.js";
import { extractPropertySchemaFragments, mergeFragments } from "./extractAnnotations.js";
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
  const ctx: SchemaContext = {
    checker,
    components,
    typeStack: new Set(),
    typeNameStack: [],
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
  return base + converted || "/";
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

  const responseSchema = typeToJsonSchema(operation.returnType, ctx, operation.returnTypeNode);

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
      let bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      bodySchema = mergeBodySchemaAnnotations(bodyParam, ctx, bodySchema);

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

function buildPathParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  for (const paramIndex of operation.pathParamIndices) {
    const param = operation.parameters[paramIndex];
    if (param) {
      let paramSchema = typeToJsonSchema(param.type, ctx);
      if (param.paramNode) {
        const frags = extractPropertySchemaFragments(ctx.checker, param.paramNode);
        if (frags.length > 0) {
          paramSchema = mergeFragments(paramSchema as Record<string, unknown>, ...frags) as JsonSchema;
        }
      }
      parameters.push({
        name: param.name,
        in: "path",
        required: !param.isOptional,
        schema: paramSchema.$ref
          ? { type: "string", $ref: paramSchema.$ref }
          : paramSchema,
      });
    }
  }
}

function isObjectLikeSchema(schema: JsonSchema, ctx: SchemaContext): boolean {
  const resolved = resolveSchemaRef(schema, ctx.components);
  
  if (resolved.type === "object" || resolved.properties || resolved.additionalProperties) {
    return true;
  }
  
  if (resolved.type === "array" && resolved.items) {
    const itemsSchema = resolveSchemaRef(resolved.items, ctx.components);
    return isObjectLikeSchema(itemsSchema, ctx);
  }
  
  return false;
}

function resolveSchemaRef(schema: JsonSchema, components: Map<string, JsonSchema>): JsonSchema {
  const ref = schema.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/components/schemas/")) {
    return schema;
  }

  const name = ref.replace("#/components/schemas/", "");
  const next = components.get(name);
  if (!next) return schema;

  return resolveSchemaRef(next, components);
}

function buildQueryParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  if (operation.queryObjectParamIndex !== null) {
    const queryParam = operation.parameters[operation.queryObjectParamIndex];
    if (!queryParam) return;

    const querySchema = typeToJsonSchema(queryParam.type, ctx);
    if (!querySchema.properties) return;

    const queryObjProps = querySchema.properties;
    for (const [propName, propSchema] of Object.entries(queryObjProps as Record<string, any>)) {
      const isRequired = querySchema.required?.includes(propName) ?? false;
      
      const isObjectLike = isObjectLikeSchema(propSchema, ctx);
      const serialization = determineQuerySerialization(propSchema.type);
      
      if (isObjectLike) {
        parameters.push({
          name: propName,
          in: "query",
          required: isRequired,
          content: {
            "application/json": {
              schema: propSchema.$ref ? propSchema : propSchema,
            },
          },
          description: `URL-encoded JSON string. Example: ${propName}=${encodeURIComponent(JSON.stringify({}))}`,
        });
      } else {
        const paramDef: any = {
          name: propName,
          in: "query",
          required: isRequired,
          schema: propSchema,
        };
        
        if (propName === "page") {
          paramDef.schema = { type: "number", default: 1 };
        } else if (propName === "pageSize") {
          paramDef.schema = { type: "number", default: 10 };
        }
        
        if (Object.keys(serialization).length > 0) {
          Object.assign(paramDef, serialization);
        }
        
        parameters.push(paramDef);
      }
    }
  }

  for (const paramIndex of operation.queryParamIndices) {
    const param = operation.parameters[paramIndex];
    if (param) {
      let paramSchema = typeToJsonSchema(param.type, ctx);
      if (param.paramNode) {
        const frags = extractPropertySchemaFragments(ctx.checker, param.paramNode);
        if (frags.length > 0) {
          paramSchema = mergeFragments(paramSchema as Record<string, unknown>, ...frags) as JsonSchema;
        }
      }

      const isObjectLike = isObjectLikeSchema(paramSchema, ctx);
      
      if (isObjectLike) {
        parameters.push({
          name: param.name,
          in: "query",
          required: !param.isOptional,
          content: {
            "application/json": {
              schema: paramSchema.$ref ? paramSchema : paramSchema,
            },
          },
        });
      } else {
        const serialization = determineQuerySerialization(paramSchema.type);
        parameters.push({
          name: param.name,
          in: "query",
          required: !param.isOptional,
          schema: paramSchema.$ref
            ? { type: "string", $ref: paramSchema.$ref }
            : paramSchema,
          ...(Object.keys(serialization).length > 0 ? serialization : {}),
        });
      }
    }
  }
}

function determineQuerySerialization(schemaType: string | string[] | undefined): { style?: string; explode?: boolean } {
  const typeArray = Array.isArray(schemaType) ? schemaType : schemaType ? [schemaType] : [];
  const isArray = typeArray.includes("array");

  if (isArray) {
    return { style: "form", explode: true };
  }

  return {};
}

function buildHeaderParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  if (operation.headerObjectParamIndex === null) return;

  const headerParam = operation.parameters[operation.headerObjectParamIndex];
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

function buildCookieParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  if (operation.cookieObjectParamIndex === null) return;

  const cookieParam = operation.parameters[operation.cookieObjectParamIndex];
  if (!cookieParam) return;

  const cookieSchema = typeToJsonSchema(cookieParam.type, ctx);
  if (!cookieSchema.properties) return;

  const cookieObjProps = cookieSchema.properties;
  for (const [propName, propSchema] of Object.entries(cookieObjProps as Record<string, any>)) {
    const isRequired = cookieSchema.required?.includes(propName) ?? false;
    parameters.push({
      name: propName,
      in: "cookie",
      required: isRequired,
      schema: propSchema,
      style: "form",
      explode: true,
    });
  }
}
