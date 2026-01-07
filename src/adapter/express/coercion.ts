import type { Request } from "express";
import type { CoerceLocation, DateCoercionOptions, CoerceOptions } from "./types.js";
import { resolveSchema } from "./openapi.js";

/**
 * Normalizes coercion options to ensure all properties are set
 * 
 * @param coerce - Optional coercion options
 * @returns Required coercion options with defaults applied
 */
export function normalizeCoerceOptions(coerce?: CoerceOptions): Required<CoerceOptions> {
    return {
        body: coerce?.body ?? false,
        query: coerce?.query ?? false,
        path: coerce?.path ?? false,
        header: coerce?.header ?? false,
        cookie: coerce?.cookie ?? false,
        dateTime: coerce?.dateTime ?? false,
        date: coerce?.date ?? false,
    };
}

/**
 * Gets date coercion options for a specific location
 * 
 * @param coerce - Required coercion options
 * @param location - The location to get options for
 * @returns Date coercion options for the specified location
 */
export function getDateCoercionOptions(
    coerce: Required<CoerceOptions>,
    location: CoerceLocation
): DateCoercionOptions {
    const enabled = coerce[location];
    return {
        dateTime: enabled && coerce.dateTime,
        date: enabled && coerce.date,
    };
}

/**
 * Coerces dates in a value based on the schema
 * 
 * @param value - The value to coerce
 * @param schema - The schema to use for coercion
 * @param dateCoercion - Date coercion options
 * @param components - OpenAPI components for schema resolution
 * @returns The coerced value
 */
export function coerceDatesWithSchema(
    value: any,
    schema: Record<string, unknown> | null,
    dateCoercion: DateCoercionOptions,
    components: Record<string, Record<string, unknown>>
): any {
    if (!schema || (!dateCoercion.date && !dateCoercion.dateTime)) return value;
    return coerceWithSchema(value, schema, dateCoercion, components, { coercePrimitives: false });
}

/**
 * Coerces a parameter value based on the schema
 * 
 * @param value - The value to coerce
 * @param schema - The schema to use for coercion
 * @param dateCoercion - Date coercion options
 * @param components - OpenAPI components for schema resolution
 * @returns The coerced value
 */
export function coerceParamValue(
    value: any,
    schema: Record<string, unknown> | null,
    dateCoercion: DateCoercionOptions,
    components: Record<string, Record<string, unknown>>
): any {
    if (!schema) return value;
    return coerceWithSchema(value, schema, dateCoercion, components, { coercePrimitives: true });
}

/**
 * Coerces a value based on the schema
 * 
 * @param value - The value to coerce
 * @param schema - The schema to use for coercion
 * @param dateCoercion - Date coercion options
 * @param components - OpenAPI components for schema resolution
 * @param options - Additional coercion options
 * @returns The coerced value
 */
export function coerceWithSchema(
    value: any,
    schema: Record<string, unknown>,
    dateCoercion: DateCoercionOptions,
    components: Record<string, Record<string, unknown>>,
    options: { coercePrimitives: boolean }
): any {
    if (value === undefined || value === null) return value;
    if (value instanceof Date) return value;

    const resolved = resolveSchema(schema, components);
    const override = resolved["x-adorn-coerce"];
    const allowDateTime = override === true ? true : override === false ? false : dateCoercion.dateTime;
    const allowDate = override === true ? true : override === false ? false : dateCoercion.date;

    const byFormat = coerceDateString(value, resolved, allowDateTime, allowDate);
    if (byFormat !== value) return byFormat;

    const allOf = resolved.allOf;
    if (Array.isArray(allOf)) {
        let out = value;
        for (const entry of allOf) {
            out = coerceWithSchema(out, entry as Record<string, unknown>, { dateTime: allowDateTime, date: allowDate }, components, options);
        }
        return out;
    }

    const variants = (resolved.oneOf ?? resolved.anyOf) as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(variants)) {
        for (const entry of variants) {
            const out = coerceWithSchema(value, entry, { dateTime: allowDateTime, date: allowDate }, components, options);
            if (out !== value) return out;
        }
    }

    const schemaType = resolved.type;
    const types = Array.isArray(schemaType) ? schemaType : schemaType ? [schemaType] : [];

    if ((types.includes("array") || resolved.items) && Array.isArray(value)) {
        const itemSchema = (resolved.items as Record<string, unknown> | undefined) ?? {};
        return value.map(item => coerceWithSchema(item, itemSchema, { dateTime: allowDateTime, date: allowDate }, components, options));
    }

    if ((types.includes("object") || resolved.properties || resolved.additionalProperties) && isPlainObject(value)) {
        const props = resolved.properties as Record<string, Record<string, unknown>> | undefined;
        const out: Record<string, unknown> = { ...value };

        if (props) {
            for (const [key, propSchema] of Object.entries(props)) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    out[key] = coerceWithSchema((value as any)[key], propSchema, { dateTime: allowDateTime, date: allowDate }, components, options);
                }
            }
        }

        const additional = resolved.additionalProperties;
        if (additional && typeof additional === "object") {
            for (const [key, entry] of Object.entries(value)) {
                if (props && Object.prototype.hasOwnProperty.call(props, key)) continue;
                out[key] = coerceWithSchema(entry, additional as Record<string, unknown>, { dateTime: allowDateTime, date: allowDate }, components, options);
            }
        }

        return out;
    }

    if (options.coercePrimitives) {
        return coercePrimitiveValue(value, types);
    }

    return value;
}

function coerceDateString(
    value: any,
    schema: Record<string, unknown>,
    allowDateTime: boolean,
    allowDate: boolean
): any {
    if (typeof value !== "string") return value;

    const format = schema.format;
    const schemaType = schema.type;
    const types = Array.isArray(schemaType) ? schemaType : schemaType ? [schemaType] : [];
    const allowsString = types.length === 0 || types.includes("string");

    if (format === "date-time" && allowDateTime && allowsString) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new Error(`Invalid date-time: ${value}`);
        }
        return parsed;
    }

    if (format === "date" && allowDate && allowsString) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new Error(`Invalid date: ${value}`);
        }
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
            throw new Error(`Invalid date: ${value}`);
        }
        return parsed;
    }

    return value;
}

function coercePrimitiveValue(value: any, types: string[]): any {
    if (value === undefined || value === null) return value;

    if (types.includes("number") || types.includes("integer")) {
        const num = Number(value);
        if (Number.isNaN(num)) {
            throw new Error(`Invalid number: ${value}`);
        }
        return num;
    }

    if (types.includes("boolean")) {
        if (value === "true") return true;
        if (value === "false") return false;
        if (typeof value === "boolean") return value;
        throw new Error(`Invalid boolean: ${value}`);
    }

    return value;
}

/**
 * Checks if a value is a plain object
 * 
 * @param value - The value to check
 * @returns True if the value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * Parses a query value based on its schema type and serialization options
 * 
 * @param value - The raw query value
 * @param param - The parameter configuration
 * @returns The parsed value
 */
export function parseQueryValue(value: any, param: { schemaType?: string | string[]; serialization?: { style?: string; explode?: boolean } }): any {
    if (value === undefined || value === null) return value;

    const isArray = Array.isArray(param.schemaType)
        ? param.schemaType.includes("array")
        : param.schemaType === "array";

    if (!isArray) return value;

    const style = param.serialization?.style ?? "form";
    const explode = param.serialization?.explode ?? true;

    if (Array.isArray(value)) {
        return value;
    }

    if (style === "form") {
        if (explode) {
            return value;
        }
        return value.split(",");
    }

    if (style === "spaceDelimited") {
        return value.split(" ");
    }

    if (style === "pipeDelimited") {
        return value.split("|");
    }

    return value;
}

/**
 * Gets the raw query string from a request
 * 
 * @param req - The Express request object
 * @returns The raw query string without the leading "?"
 */
export function getRawQueryString(req: Request): string {
    const url = req.originalUrl ?? req.url ?? "";
    const index = url.indexOf("?");
    if (index === -1) return "";
    return url.slice(index + 1);
}

/**
 * Parses query string parameters with deep object style
 * 
 * @param rawQuery - The raw query string
 * @param names - Set of parameter names that use deepObject style
 * @param maxDepth - Maximum nesting depth (default: 5)
 * @returns Object containing the parsed deep object parameters
 */
export function parseDeepObjectParams(
    rawQuery: string,
    names: Set<string>,
    maxDepth: number = 5
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!rawQuery || names.size === 0) return out;

    const params = new URLSearchParams(rawQuery);
    for (const [key, value] of params.entries()) {
        const path = parseBracketPath(key);
        if (path.length === 0) continue;
        if (path.length > maxDepth) {
            throw new Error(`Query parameter nesting depth (${path.length}) exceeds maximum of ${maxDepth}`);
        }
        const root = path[0];
        if (!names.has(root)) continue;
        assignDeepValue(out, path, value);
    }

    return out;
}

function parseBracketPath(key: string): string[] {
    const parts: string[] = [];
    let current = "";

    for (let i = 0; i < key.length; i++) {
        const ch = key[i];
        if (ch === "[") {
            if (current) parts.push(current);
            current = "";
            continue;
        }
        if (ch === "]") {
            if (current) parts.push(current);
            current = "";
            continue;
        }
        current += ch;
    }

    if (current) parts.push(current);
    return parts;
}

function assignDeepValue(
    target: Record<string, unknown>,
    path: string[],
    value: string
): void {
    let cursor: Record<string, unknown> = target;

    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (!key) continue;
        const isLast = i === path.length - 1;

        if (isLast) {
            const existing = cursor[key];
            if (existing === undefined) {
                cursor[key] = value;
            } else if (Array.isArray(existing)) {
                existing.push(value);
            } else {
                cursor[key] = [existing as unknown, value];
            }
            return;
        }

        const next = cursor[key];
        if (!isPlainObject(next)) {
            cursor[key] = {};
        }
        cursor = cursor[key] as Record<string, unknown>;
    }
}

/**
 * Parses cookies from a cookie header
 * 
 * @param cookieHeader - The cookie header string
 * @returns Object containing the parsed cookies
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {};

    const cookies: Record<string, string> = {};
    const pairs = cookieHeader.split(";");

    for (const pair of pairs) {
        const [name, ...valueParts] = pair.trim().split("=");
        if (name) {
            cookies[name] = valueParts.join("=");
        }
    }

    return cookies;
}

/**
 * Normalizes a sort parameter to an array of strings
 * 
 * @param sort - The sort parameter (array or string)
 * @returns Array of sort field names
 */
export function normalizeSort(sort: unknown): string[] {
    if (Array.isArray(sort)) {
        return sort.map(s => String(s));
    }
    if (typeof sort === "string") {
        return sort.split(",").map(s => s.trim()).filter(Boolean);
    }
    return [];
}

