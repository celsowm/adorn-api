import type { BoundRoute } from "./merge.js";
import type { OpenAPI31 } from "./types.js";

/**
 * Converts an Express path to OpenAPI path format
 * 
 * @param path - Express path with colon parameters
 * @returns OpenAPI path with curly brace parameters
 */
export function toOpenApiPath(path: string): string {
    return path.replace(/:([^/]+)/g, "{$1}");
}

/**
 * Gets the OpenAPI operation for a given route
 * 
 * @param openapi - The OpenAPI specification
 * @param route - The bound route
 * @returns OpenAPI operation object or null
 */
export function getOpenApiOperation(openapi: OpenAPI31, route: BoundRoute): any | null {
    const pathKey = toOpenApiPath(route.fullPath);
    const pathItem = openapi.paths?.[pathKey];
    if (!pathItem) return null;
    return pathItem[route.httpMethod.toLowerCase()] ?? null;
}

/**
 * Creates an index of parameter schemas by location and name
 * 
 * @param operation - OpenAPI operation object
 * @returns Map of parameter schemas keyed by location:name
 */
export function getParamSchemaIndex(operation: any | null): Map<string, Record<string, unknown>> {
    const index = new Map<string, Record<string, unknown>>();
    const params = operation?.parameters ?? [];
    for (const param of params) {
        if (!param?.name || !param?.in) continue;
        if (param.schema) {
            index.set(`${param.in}:${param.name}`, param.schema);
        }
    }
    return index;
}

/**
 * Gets a parameter schema from the index
 * 
 * @param index - The parameter schema index
 * @param location - The parameter location
 * @param name - The parameter name
 * @returns Parameter schema or null
 */
export function getParamSchemaFromIndex(
    index: Map<string, Record<string, unknown>>,
    location: "path" | "query" | "header" | "cookie",
    name: string
): Record<string, unknown> | null {
    return index.get(`${location}:${name}`) ?? null;
}

/**
 * Gets the request body schema for an operation
 * 
 * @param operation - OpenAPI operation object
 * @param contentType - Optional content type to retrieve
 * @returns Request body schema or null
 */
export function getRequestBodySchema(operation: any | null, contentType?: string): Record<string, unknown> | null {
    const content = operation?.requestBody?.content;
    if (!content) return null;

    if (contentType && content[contentType]?.schema) {
        return content[contentType].schema;
    }

    const first = Object.values(content)[0] as Record<string, unknown> | undefined;
    return (first as any)?.schema ?? null;
}

/**
 * Creates a schema from a type
 * 
 * @param schemaType - Schema type (string or array of strings)
 * @returns Schema object or null
 */
export function schemaFromType(schemaType?: string | string[]): Record<string, unknown> | null {
    if (!schemaType) return null;
    return { type: schemaType };
}

/**
 * Resolves a schema, following $ref references
 * 
 * @param schema - The schema to resolve
 * @param components - OpenAPI components for reference resolution
 * @param seen - Set of already seen references to prevent cycles
 * @returns Resolved schema
 */
export function resolveSchema(
    schema: Record<string, unknown>,
    components: Record<string, Record<string, unknown>>,
    seen: Set<string> = new Set()
): Record<string, unknown> {
    const ref = schema.$ref;
    if (typeof ref !== "string" || !ref.startsWith("#/components/schemas/")) {
        return schema;
    }

    const name = ref.replace("#/components/schemas/", "");
    if (seen.has(name)) return schema;

    const next = components[name];
    if (!next) return schema;

    seen.add(name);
    return resolveSchema(next, components, seen);
}

/**
 * Gets a schema from OpenAPI by reference
 * 
 * @param openapi - The OpenAPI specification
 * @param ref - The schema reference
 * @returns Schema object or null
 */
export function getSchemaByRef(openapi: OpenAPI31, ref: string): Record<string, unknown> | null {
    if (!ref.startsWith("#/components/schemas/")) return null;
    const schemaName = ref.replace("#/components/schemas/", "");
    return openapi.components.schemas[schemaName] || null;
}
