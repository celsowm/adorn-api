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
      
      const schema = paramSchema.$ref
        ? { $ref: paramSchema.$ref }
        : paramSchema;
      
      parameters.push({
        name: param.name,
        in: "path",
        required: !param.isOptional,
        schema,
      });
    }
  }
}

function isObjectLikeSchema(schema: JsonSchema, ctx: SchemaContext): boolean {
  const resolved = resolveSchemaRef(schema, ctx.components);
  
  if (resolved.type === "object" || resolved.properties || resolved.additionalProperties) {
    return true;
  }
  
  if (resolved.allOf) {
    for (const branch of resolved.allOf) {
      if (isObjectLikeSchema(branch, ctx)) {
        return true;
      }
    }
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

function resolveAndCollectObjectProps(
  schema: JsonSchema,
  components: Map<string, JsonSchema>
): { properties: Record<string, JsonSchema>; required: string[] } {
  const resolved = resolveSchemaRef(schema, components);
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  
  const processSchema = (s: JsonSchema): void => {
    const current = resolveSchemaRef(s, components);
    
    if (current.properties) {
      for (const [key, val] of Object.entries(current.properties)) {
        if (!properties[key]) {
          properties[key] = val;
        }
      }
    }
    
    if (current.required) {
      for (const req of current.required) {
        if (!required.includes(req)) {
          required.push(req);
        }
      }
    }
    
    if (current.allOf) {
      for (const branch of current.allOf) {
        processSchema(branch);
      }
    }
  };
  
  processSchema(resolved);
  return { properties, required };
}

function buildQueryParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
  if (operation.queryObjectParamIndex !== null) {
    const queryParam = operation.parameters[operation.queryObjectParamIndex];
    if (!queryParam) return;
    
    const querySchema = typeToJsonSchema(queryParam.type, ctx);
    const { properties: queryObjProps, required: queryRequired } = 
      resolveAndCollectObjectProps(querySchema, ctx.components);
    
    for (const [propName, propSchema] of Object.entries(queryObjProps)) {
      const isRequired = queryRequired.includes(propName);
      
      const isObjectLike = isObjectLikeSchema(propSchema, ctx);
      const serialization = determineQuerySerialization(propSchema.type);
      const exampleValue = generateExampleValue(propSchema, propName);
      
      if (isObjectLike) {
        const schemaRef = propSchema.$ref || "#/components/schemas/InlineQueryParam";
        parameters.push({
          name: propName,
          in: "query",
          required: isRequired,
          schema: { type: "string" },
          description: `JSON-encoded object. ${exampleValue}`,
          example: parseExampleValue(exampleValue),
          "x-adorn-jsonSchemaRef": schemaRef,
        });
      } else {
        const paramDef: any = {
          name: propName,
          in: "query",
          required: isRequired,
          schema: propSchema.$ref ? { $ref: propSchema.$ref } : propSchema,
        };
        
        if (propName === "page") {
          paramDef.schema = { type: "integer", default: 1, minimum: 1 };
        } else if (propName === "pageSize") {
          paramDef.schema = { type: "integer", default: 10, minimum: 1 };
        } else if (propName === "totalItems") {
          paramDef.schema = { type: "integer", minimum: 0 };
        } else if (propName === "sort") {
          paramDef.schema = {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } }
            ]
          };
        } else if (propName === "q") {
          paramDef.schema = { type: "string" };
        } else if (propName === "hasComments") {
          paramDef.schema = { type: "boolean" };
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
        const schemaRef = paramSchema.$ref || "#/components/schemas/InlineQueryParam";
        const exampleValue = generateExampleValue(paramSchema, param.name);
        parameters.push({
          name: param.name,
          in: "query",
          required: !param.isOptional,
          schema: { type: "string" },
          description: `JSON-encoded object. ${exampleValue}`,
          example: parseExampleValue(exampleValue),
          "x-adorn-jsonSchemaRef": schemaRef,
        });
      } else {
        const serialization = determineQuerySerialization(paramSchema.type);
        parameters.push({
          name: param.name,
          in: "query",
          required: !param.isOptional,
          schema: paramSchema.$ref ? { $ref: paramSchema.$ref } : paramSchema,
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

function generateExampleValue(schema: JsonSchema, propName: string): string {
  const resolved = resolveSchemaRef(schema, new Map());
  
  if (resolved.type === "object" && resolved.properties) {
    const example: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(resolved.properties)) {
      const propResolved = resolveSchemaRef(prop, new Map());
      if (propResolved.type === "string") {
        example[key] = "value";
      } else if (propResolved.type === "number" || propResolved.type === "integer") {
        example[key] = 1;
      } else if (propResolved.type === "boolean") {
        example[key] = true;
      } else if (Array.isArray(propResolved.type) && propResolved.type.includes("null")) {
        example[key] = null;
      } else if (propResolved.enum) {
        example[key] = propResolved.enum[0];
      } else {
        example[key] = "value";
      }
    }
    return `Example: ${propName}=${JSON.stringify(example)}`;
  }
  
  return `Example: ${propName}=${JSON.stringify({ key: "value" })}`;
}

function parseExampleValue(description: string): string {
  const match = description.match(/Example:\s*\w+=(\{[^}]+\})/);
  if (match) {
    return match[1];
  }
  return JSON.stringify({ key: "value" });
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
