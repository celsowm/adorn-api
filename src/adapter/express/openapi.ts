import type { BoundRoute } from "./merge.js";
import type { OpenAPI31 } from "./types.js";

export function toOpenApiPath(path: string): string {
    return path.replace(/:([^/]+)/g, "{$1}");
}

export function getOpenApiOperation(openapi: OpenAPI31, route: BoundRoute): any | null {
    const pathKey = toOpenApiPath(route.fullPath);
    const pathItem = openapi.paths?.[pathKey];
    if (!pathItem) return null;
    return pathItem[route.httpMethod.toLowerCase()] ?? null;
}

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

export function getParamSchemaFromIndex(
    index: Map<string, Record<string, unknown>>,
    location: "path" | "query" | "header" | "cookie",
    name: string
): Record<string, unknown> | null {
    return index.get(`${location}:${name}`) ?? null;
}

export function getRequestBodySchema(operation: any | null, contentType?: string): Record<string, unknown> | null {
    const content = operation?.requestBody?.content;
    if (!content) return null;

    if (contentType && content[contentType]?.schema) {
        return content[contentType].schema;
    }

    const first = Object.values(content)[0] as Record<string, unknown> | undefined;
    return (first as any)?.schema ?? null;
}

export function schemaFromType(schemaType?: string | string[]): Record<string, unknown> | null {
    if (!schemaType) return null;
    return { type: schemaType };
}

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

export function getSchemaByRef(openapi: OpenAPI31, ref: string): Record<string, unknown> | null {
    if (!ref.startsWith("#/components/schemas/")) return null;
    const schemaName = ref.replace("#/components/schemas/", "");
    return openapi.components.schemas[schemaName] || null;
}
