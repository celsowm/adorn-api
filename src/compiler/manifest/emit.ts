/**
 * Manifest generation module.
 * Creates the manifest file describing the compiled API structure.
 */
import type { ScannedController, ScannedOperation } from "../analyze/scanControllers.js";
import type { ManifestV1, ControllerEntry, OperationEntry, ArgsSpec, HttpMethod } from "./format.js";
import { typeToJsonSchema } from "../schema/typeToJsonSchema.js";
import type { SchemaContext, JsonSchema } from "../schema/typeToJsonSchema.js";
import ts from "typescript";

type ValidationMode = "none" | "ajv-runtime" | "precompiled";

/**
 * Generates the manifest file content from scanned controllers.
 * The manifest describes the complete API structure including all controllers, operations, and their parameters.
 * 
 * @param controllers - Array of scanned controllers to include in the manifest
 * @param checker - TypeScript type checker for analyzing types
 * @param version - Version of the adorn-api package
 * @param validationMode - Validation mode to specify in the manifest (default: "ajv-runtime")
 * @returns The generated manifest object
 */
export function generateManifest(
  controllers: ScannedController[],
  checker: ts.TypeChecker,
  version: string,
  validationMode: ValidationMode = "ajv-runtime"
): ManifestV1 {
  const components = new Map<string, any>();
  const ctx: SchemaContext = {
    checker,
    components,
    typeStack: new Set(),
    typeNameStack: [],
    mode: "request",
  };

  const controllerEntries: ControllerEntry[] = controllers.map(ctrl => ({
    controllerId: ctrl.className,
    basePath: ctrl.basePath,
    operations: ctrl.operations.map(op => buildOperationEntry(op, ctx)),
  }));

  const validationConfig: { mode: "none" | "ajv-runtime" | "precompiled"; precompiledModule: string | null } =
    validationMode === "precompiled"
      ? { mode: "precompiled", precompiledModule: null }
      : validationMode === "none"
        ? { mode: "none", precompiledModule: null }
        : { mode: "ajv-runtime", precompiledModule: null };

  return {
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: {
      name: "adorn-api",
      version,
      typescript: ts.version,
    },
    schemas: {
      kind: "openapi-3.1",
      file: "./openapi.json",
      componentsSchemasPointer: "/components/schemas",
    },
    validation: validationConfig,
    controllers: controllerEntries,
  };
}

/**
 * Recursively resolves $ref references in JSON Schema objects.
 * @internal
 */
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

/**
 * Resolves and collects properties from an object schema, handling $ref and allOf.
 * @internal
 */
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

/**
 * Checks if a schema represents a deepObject style parameter (object but not array).
 * @internal
 */
function isDeepObjectSchema(schema: JsonSchema, components: Map<string, JsonSchema>): boolean {
  const resolved = resolveSchemaRef(schema, components);
  
  if (resolved.type === "array") {
    return false;
  }
  
  if (resolved.type === "object" || resolved.properties || resolved.additionalProperties) {
    return true;
  }
  
  if (resolved.allOf) {
    for (const branch of resolved.allOf) {
      if (isDeepObjectSchema(branch, components)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Checks if a schema represents an object-like structure.
 * @internal
 */
function isObjectLikeSchema(schema: JsonSchema, components: Map<string, JsonSchema>): boolean {
  const resolved = resolveSchemaRef(schema, components);
  
  if (resolved.type === "object" || resolved.properties || resolved.additionalProperties) {
    return true;
  }
  
  if (resolved.allOf) {
    for (const branch of resolved.allOf) {
      if (isObjectLikeSchema(branch, components)) {
        return true;
      }
    }
  }
  
  if (resolved.type === "array" && resolved.items) {
    const itemsSchema = resolveSchemaRef(resolved.items, components);
    return isObjectLikeSchema(itemsSchema, components);
  }
  
  return false;
}

/**
 * Builds an OperationEntry from a ScannedOperation.
 * @internal
 */
function buildOperationEntry(op: ScannedOperation, ctx: SchemaContext): OperationEntry {
  const args: ArgsSpec = {
    body: null,
    path: [],
    query: [],
    headers: [],
    cookies: [],
  };

  buildPathArgs(op, ctx, args);
  buildQueryArgs(op, ctx, args);
  buildHeaderArgs(op, ctx, args);
  buildCookieArgs(op, ctx, args);

  if (op.bodyParamIndex !== null) {
    const bodyParam = op.parameters[op.bodyParamIndex];
    if (bodyParam) {
      const bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      const schemaRef = bodySchema.$ref ?? "#/components/schemas/InlineBody";

      args.body = {
        index: bodyParam.index,
        required: !bodyParam.isOptional,
        contentType: op.bodyContentType ?? "application/json",
        schemaRef,
      };
    }
  }

  const responseSchema = typeToJsonSchema(op.returnType, ctx, op.returnTypeNode);
  const status = op.httpMethod === "POST" ? 201 : 200;

  let schemaRef = responseSchema.$ref;
  let isArray = false;

  if (!schemaRef && responseSchema.type === "array" && responseSchema.items?.$ref) {
    schemaRef = responseSchema.items.$ref;
    isArray = true;
  } else if (!schemaRef) {
    schemaRef = "#/components/schemas/InlineResponse";
  }

  return {
    operationId: op.operationId,
    http: {
      method: op.httpMethod as HttpMethod,
      path: op.path,
    },
    handler: {
      methodName: op.methodName,
    },
    args,
    responses: [
      {
        status,
        contentType: "application/json",
        schemaRef,
        isArray,
      },
    ],
  };
}

/**
 * Builds path argument specifications from scanned operation parameters.
 * @internal
 */
function buildPathArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  for (const paramIndex of op.pathParamIndices) {
    const param = op.parameters[paramIndex];
    if (param) {
      const paramSchema = typeToJsonSchema(param.type, ctx);

      args.path.push({
        name: param.name,
        index: param.index,
        required: !param.isOptional,
        schemaRef: paramSchema.$ref ?? "#/components/schemas/InlinePathParam",
        schemaType: paramSchema.type,
      });
    }
  }
}

/**
 * Builds query argument specifications from scanned operation parameters.
 * @internal
 */
function buildQueryArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  if (op.queryObjectParamIndex !== null) {
    const queryParam = op.parameters[op.queryObjectParamIndex];
    if (!queryParam) return;

    const querySchema = typeToJsonSchema(queryParam.type, ctx);
    const { properties: queryObjProps, required: queryRequired } = 
      resolveAndCollectObjectProps(querySchema, ctx.components);
    
    for (const [propName, propSchema] of Object.entries(queryObjProps)) {
      const isRequired = queryRequired.includes(propName) ?? false;
      const isDeepObject = isDeepObjectSchema(propSchema, ctx.components);
      const isObjectLike = isObjectLikeSchema(propSchema, ctx.components);
      
      let schemaRef = (propSchema as any).$ref;
      if (!schemaRef) {
        schemaRef = "#/components/schemas/InlineQueryParam";
      }

      args.query.push({
        name: propName,
        index: queryParam.index,
        required: isRequired,
        schemaRef,
        schemaType: (propSchema as any).type,
        serialization: isDeepObject ? { style: "deepObject", explode: true } : undefined,
        content: !isDeepObject && isObjectLike ? "application/json" : undefined,
      });
    }
  }

  for (const paramIndex of op.queryParamIndices) {
    const param = op.parameters[paramIndex];
    if (param) {
      const paramSchema = typeToJsonSchema(param.type, ctx);
      const isDeepObject = isDeepObjectSchema(paramSchema, ctx.components);
      const isObjectLike = isObjectLikeSchema(paramSchema, ctx.components);
      const schemaRef = (paramSchema as any).$ref ?? "#/components/schemas/InlineQueryParam";

      args.query.push({
        name: param.name,
        index: param.index,
        required: !param.isOptional,
        schemaRef,
        schemaType: (paramSchema as any).type,
        serialization: isDeepObject ? { style: "deepObject", explode: true } : undefined,
        content: !isDeepObject && isObjectLike ? "application/json" : undefined,
      });
    }
  }
}

/**
 * Builds header argument specifications from scanned operation parameters.
 * @internal
 */
function buildHeaderArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  if (op.headerObjectParamIndex === null) return;

  const headerParam = op.parameters[op.headerObjectParamIndex];
  if (!headerParam) return;

  const headerSchema = typeToJsonSchema(headerParam.type, ctx);
  if (!headerSchema.properties) return;

  for (const [propName, propSchema] of Object.entries(headerSchema.properties as Record<string, any>)) {
    const isRequired = headerSchema.required?.includes(propName) ?? false;
    let schemaRef = propSchema.$ref;
    if (!schemaRef) {
      schemaRef = "#/components/schemas/InlineHeaderParam";
    }

    args.headers.push({
      name: propName,
      index: headerParam.index,
      required: isRequired,
      schemaRef,
      schemaType: propSchema.type,
    });
  }
}

/**
 * Builds cookie argument specifications from scanned operation parameters.
 * @internal
 */
function buildCookieArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  if (op.cookieObjectParamIndex === null) return;

  const cookieParam = op.parameters[op.cookieObjectParamIndex];
  if (!cookieParam) return;

  const cookieSchema = typeToJsonSchema(cookieParam.type, ctx);
  if (!cookieSchema.properties) return;

  for (const [propName, propSchema] of Object.entries(cookieSchema.properties as Record<string, any>)) {
    const isRequired = cookieSchema.required?.includes(propName) ?? false;
    let schemaRef = propSchema.$ref;
    if (!schemaRef) {
      schemaRef = "#/components/schemas/InlineCookieParam";
    }

    args.cookies.push({
      name: propName,
      index: cookieParam.index,
      required: isRequired,
      schemaRef,
      schemaType: propSchema.type,
      serialization: { style: "form", explode: true },
    });
  }
}
