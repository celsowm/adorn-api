/**
 * Parameter specification building module.
 * Converts scanned parameters to OpenAPI parameter objects.
 */
import type { ScannedOperation } from "../analyze/scanControllers.js";
import type { SchemaContext, JsonSchema } from "./types.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";
import { extractPropertySchemaFragments, mergeFragments } from "./extractAnnotations.js";

/**
 * Builds OpenAPI path parameter objects from scanned operation parameters.
 * Adds them to the provided parameters array.
 * 
 * @param operation - The scanned operation containing path parameters
 * @param ctx - The schema generation context
 * @param parameters - Array to accumulate parameter objects
 */
export function buildPathParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
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
      
      const paramName = param.name.toLowerCase();
      const isIdParam = paramName === "id" || paramName.endsWith("id");
      
      if (!schema.$ref && schema.type === "number" && isIdParam) {
        schema.type = "integer";
        if (!schema.minimum) {
          schema.minimum = 1;
        }
      }
      
      parameters.push({
        name: param.name,
        in: "path",
        required: !param.isOptional,
        schema,
      });
    }
  }
}

/**
 * Builds OpenAPI query parameter objects from scanned operation parameters.
 * Handles both individual query parameters and query objects.
 * 
 * @param operation - The scanned operation containing query parameters
 * @param ctx - The schema generation context
 * @param parameters - Array to accumulate parameter objects
 */
export function buildQueryParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
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
          examples: {
            default: { value: parseExampleValue(exampleValue) }
          },
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
          examples: {
            default: { value: parseExampleValue(exampleValue) }
          },
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

/**
 * Builds OpenAPI header parameter objects from scanned operation parameters.
 * Extracts individual header parameters from a headers object.
 * 
 * @param operation - The scanned operation containing header parameters
 * @param ctx - The schema generation context
 * @param parameters - Array to accumulate parameter objects
 */
export function buildHeaderParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
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

/**
 * Builds OpenAPI cookie parameter objects from scanned operation parameters.
 * Extracts individual cookie parameters from a cookies object.
 * 
 * @param operation - The scanned operation containing cookie parameters
 * @param ctx - The schema generation context
 * @param parameters - Array to accumulate parameter objects
 */
export function buildCookieParameters(operation: ScannedOperation, ctx: SchemaContext, parameters: any[]): void {
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

/**
 * Determines OpenAPI serialization style/explode options based on schema type.
 * 
 * @param schemaType - The schema type(s) to analyze
 * @returns Object containing style and explode options if applicable
 */
export function determineQuerySerialization(schemaType: string | string[] | undefined): { style?: string; explode?: boolean } {
  const typeArray = Array.isArray(schemaType) ? schemaType : schemaType ? [schemaType] : [];
  const isArray = typeArray.includes("array");

  if (isArray) {
    return { style: "form", explode: true };
  }

  return {};
}

/**
 * Generates an example value description for a schema.
 * Creates a human-readable example showing the expected structure.
 * 
 * @param schema - The JSON Schema to generate example for
 * @param propName - The property name for the example
 * @returns A description string with example value
 */
export function generateExampleValue(schema: JsonSchema, propName: string): string {
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

/**
 * Parses an example value from a description string.
 * Extracts the JSON object from "Example: propName={...}" format.
 * 
 * @param description - The description string to parse
 * @returns The extracted JSON string, or default if not found
 */
export function parseExampleValue(description: string): string {
  const match = description.match(/Example:\s*\w+=(\{[^}]+\})/);
  if (match) {
    return match[1];
  }
  return JSON.stringify({ key: "value" });
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

/**
 * Recursively resolves $ref references in a JSON Schema.
 * 
 * @param schema - The schema to resolve references in
 * @param components - Map of component schemas for reference resolution
 * @returns The resolved schema with all references followed
 */
export function resolveSchemaRef(schema: JsonSchema, components: Map<string, JsonSchema>): JsonSchema {
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
 * Resolves object schema references and collects all properties.
 * Handles allOf composition and $ref resolution.
 * 
 * @param schema - The object schema to process
 * @param components - Map of component schemas for reference resolution
 * @returns Object containing all collected properties and required fields
 */
export function resolveAndCollectObjectProps(
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
