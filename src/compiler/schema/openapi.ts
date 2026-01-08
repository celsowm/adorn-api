/**
 * OpenAPI specification generation module.
 * Converts scanned controllers to OpenAPI 3.1 format.
 */
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
} from "./parameters.js";
import { analyzeQueryBuilderForSchema, type QueryBuilderSchema } from "./queryBuilderAnalyzer.js";
import { buildSchemaFromQueryBuilder, wrapInPaginatedResult } from "./queryBuilderSchemaBuilder.js";

const METAL_ORM_WRAPPER_NAMES = ["BelongsToReference", "HasOneReference", "HasManyCollection", "ManyToManyCollection"];

/**
 * OpenAPI 3.1 specification interface.
 */
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

/**
 * Progress callback for OpenAPI generation
 */
export interface OpenAPIProgressCallback {
  (message: string, current: number, total: number): void;
}

/**
 * Generates an OpenAPI 3.1 specification from scanned controllers.
 * 
 * @param controllers - Array of scanned controllers to include in the spec
 * @param checker - TypeScript type checker for type analysis
 * @param options - Optional title and version for the OpenAPI info object
 * @param onProgress - Optional callback to report progress during generation
 * @returns Complete OpenAPI 3.1 specification object
 */
export function generateOpenAPI(
  controllers: ScannedController[],
  checker: ts.TypeChecker,
  options: { title?: string; version?: string; onProgress?: OpenAPIProgressCallback } = {}
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
  const { onProgress } = options;

  for (let i = 0; i < controllers.length; i++) {
    const controller = controllers[i];
    if (onProgress) {
      onProgress(`Processing controller ${controller.className}`, i + 1, controllers.length);
    }
    
    for (const operation of controller.operations) {
      const fullPath = convertToOpenApiPath(controller.basePath, operation.path);

      if (!paths[fullPath]) {
        paths[fullPath] = {};
      }

      const method = operation.httpMethod.toLowerCase();
      paths[fullPath][method] = buildOperation(operation, ctx, controller.consumes);
    }
  }

  const schemas = Object.fromEntries(components);
  
  if (onProgress) {
    onProgress("Generating and cleaning schemas", controllers.length, controllers.length);
  }
  
  cleanupMetalOrmWrappers(schemas, paths);

  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "API",
      version: options.version ?? "1.0.0",
    },
    components: {
      schemas,
    },
    paths,
  };
}

function cleanupMetalOrmWrappers(schemas: Record<string, JsonSchema>, paths: Record<string, any>): void {
  const schemasToDelete = new Set<string>();
  
  for (const wrapperName of METAL_ORM_WRAPPER_NAMES) {
    if (schemas[wrapperName]) {
      schemasToDelete.add(wrapperName);
    }
    if (schemas[`${wrapperName}Api`]) {
      schemasToDelete.add(`${wrapperName}Api`);
    }
  }
  
  for (const schema of Object.values(schemas)) {
    cleanupSchemaRefs(schema, schemasToDelete);
  }
  
  for (const pathItem of Object.values(paths)) {
    cleanupPathItemRefs(pathItem, schemasToDelete);
  }
  
  for (const schemaName of schemasToDelete) {
    delete schemas[schemaName];
  }
}

function cleanupSchemaRefs(schema: any, schemasToDelete: Set<string>): void {
  if (typeof schema !== "object" || schema === null) {
    return;
  }
  
  if (schema.properties) {
    for (const propName of Object.keys(schema.properties)) {
      const propSchema = schema.properties[propName];
      if (propSchema.$ref && typeof propSchema.$ref === "string") {
        const refName = propSchema.$ref.replace("#/components/schemas/", "");
        if (schemasToDelete.has(refName)) {
          delete schema.properties[propName];
          if (schema.required && Array.isArray(schema.required)) {
            schema.required = schema.required.filter((r: string) => r !== propName);
          }
        }
      } else {
        cleanupSchemaRefs(propSchema, schemasToDelete);
      }
    }
  }
  
  if (schema.items) {
    cleanupSchemaRefs(schema.items, schemasToDelete);
  }
  
  if (schema.allOf) {
    for (const item of schema.allOf) {
      cleanupSchemaRefs(item, schemasToDelete);
    }
  }
}

function cleanupPathItemRefs(pathItem: any, schemasToDelete: Set<string>): void {
  if (typeof pathItem !== "object" || pathItem === null) {
    return;
  }
  
  for (const method of Object.keys(pathItem)) {
    const operation: any = pathItem[method];
    if (typeof operation !== "object" || operation === null) continue;
    
    if (operation.requestBody) {
      cleanupRequestBodyRefs(operation.requestBody, schemasToDelete);
    }
    
    if (operation.responses) {
      const responses: any[] = Object.values(operation.responses);
      for (const response of responses) {
        if (response.content) {
          const contentTypes: any[] = Object.values(response.content);
          for (const contentType of contentTypes) {
            if (contentType.schema) {
              cleanupSchemaRefs(contentType.schema, schemasToDelete);
            }
          }
        }
      }
    }
  }
}

function cleanupRequestBodyRefs(requestBody: any, schemasToDelete: Set<string>): void {
  if (typeof requestBody !== "object" || requestBody === null) return;
  
  if (requestBody.content) {
    const contentTypes: any[] = Object.values(requestBody.content);
    for (const contentType of contentTypes) {
      if (contentType.schema) {
        cleanupSchemaRefs(contentType.schema, schemasToDelete);
      }
    }
  }
  
  if (requestBody.properties) {
    for (const propName of Object.keys(requestBody.properties)) {
      const propSchema = requestBody.properties[propName];
      if (propSchema.$ref && typeof propSchema.$ref === "string") {
        const refName = propSchema.$ref.replace("#/components/schemas/", "");
        if (schemasToDelete.has(refName)) {
          delete requestBody.properties[propName];
          if (requestBody.required && Array.isArray(requestBody.required)) {
            requestBody.required = requestBody.required.filter((r: string) => r !== propName);
          }
        }
      } else {
        cleanupSchemaRefs(propSchema, schemasToDelete);
      }
    }
  }
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

function tryInferQueryBuilderSchema(
  operation: ScannedOperation,
  checker: ts.TypeChecker
): QueryBuilderSchema | null {
  return analyzeQueryBuilderForSchema(operation.methodDeclaration, checker) ?? null;
}

function getEntityTypeFromReturnType(
  operation: ScannedOperation,
  checker: ts.TypeChecker
): ts.Type | null {
  const returnType = operation.returnType;
  
  const unwrapPromise = (type: ts.Type): ts.Type => {
    const symbol = type.getSymbol();
    if (symbol?.getName() === "Promise") {
      const typeArgs = (type as ts.TypeReference).typeArguments;
      if (typeArgs && typeArgs.length > 0) {
        return typeArgs[0];
      }
    }
    return type;
  };

  const innerType = unwrapPromise(returnType);
  
  const symbol = innerType.getSymbol();
  if (symbol?.getName() === "PaginatedResult") {
    const typeArgs = (innerType as ts.TypeReference).typeArguments;
    if (typeArgs && typeArgs.length > 0) {
      return typeArgs[0];
    }
  }
  
  return null;
}

function filterSchemaByQueryBuilder(
  querySchema: QueryBuilderSchema,
  operation: ScannedOperation,
  ctx: SchemaContext
): JsonSchema {
  const entityType = getEntityTypeFromReturnType(operation, ctx.checker);
  
  if (!entityType) {
    return {};
  }

  const entitySchema = typeToJsonSchema(entityType, ctx);
  
  let baseSchema = entitySchema;
  if (entitySchema.$ref && entitySchema.$ref.startsWith('#/components/schemas/')) {
    const schemaName = entitySchema.$ref.replace('#/components/schemas/', '');
    const componentSchema = ctx.components.get(schemaName);
    if (componentSchema) {
      baseSchema = componentSchema;
    }
  }
  
  if (!baseSchema.properties || Object.keys(baseSchema.properties).length === 0) {
    return {};
  }

  const filteredSchema = buildFilteredSchema(querySchema, baseSchema);
  
  if (querySchema.isPaged) {
    return wrapInPaginatedResult(filteredSchema);
  }

  return filteredSchema;
}

function buildFilteredSchema(
  querySchema: QueryBuilderSchema,
  entitySchema: JsonSchema
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of querySchema.selectedFields) {
    if (entitySchema.properties?.[field]) {
      properties[field] = entitySchema.properties[field];
      if (entitySchema.required && entitySchema.required.includes(field)) {
        required.push(field);
      }
    }
  }

  for (const [relationName, includeSpec] of Object.entries(querySchema.includes)) {
    if (entitySchema.properties?.[relationName]) {
      properties[relationName] = {
        type: "object",
        properties: {
          id: { type: "integer" }
        },
        required: ["id"]
      };
      if (entitySchema.required && entitySchema.required.includes(relationName)) {
        required.push(relationName);
      }
    }
  }

  const schema: JsonSchema = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
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
  
  let responseSchema: JsonSchema;
  
  const querySchema = tryInferQueryBuilderSchema(operation, ctx.checker);
  if (querySchema) {
    const entityType = getEntityTypeFromReturnType(operation, ctx.checker);
    if (entityType) {
      responseSchema = filterSchemaByQueryBuilder(querySchema, operation, responseCtx);
    } else {
      responseSchema = typeToJsonSchema(operation.returnType, responseCtx, operation.returnTypeNode);
    }
  } else {
    responseSchema = typeToJsonSchema(operation.returnType, responseCtx, operation.returnTypeNode);
  }

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
