import type { Request } from "express";
import type { BoundRoute } from "./merge.js";
import type { OpenAPI31, ValidationError } from "./types.js";
import { createValidator } from "../../runtime/validation/ajv.js";
import {
    getOpenApiOperation,
    getParamSchemaIndex,
    getParamSchemaFromIndex,
    resolveSchema,
    getSchemaByRef
} from "./openapi.js";
import {
    getRawQueryString,
    parseDeepObjectParams,
    coerceParamValue
} from "./coercion.js";

/**
 * Validates a request using precompiled validators
 * 
 * @param route - The bound route configuration
 * @param req - The Express request object
 * @param validators - Precompiled validators for the route
 * @returns Array of validation errors, or null if validation passes
 */
export function validateRequestWithPrecompiled(
    route: BoundRoute,
    req: Request,
    validators: Record<string, { body?: (data: unknown) => boolean; response: Record<string, (data: unknown) => boolean> }>
): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const deepNames = new Set(route.args.query.filter(q => q.serialization?.style === "deepObject").map(q => q.name));
    const deepValues = deepNames.size > 0
        ? parseDeepObjectParams(getRawQueryString(req), deepNames)
        : {};

    if (route.args.body) {
        const validator = validators[route.operationId]?.body;
        if (validator) {
            const valid = validator(req.body);
            if (!valid) {
                const v = validators[route.operationId].body as any;
                for (const err of v.errors || []) {
                    errors.push({
                        path: `#/body${err.instancePath}`,
                        message: err.message || "Invalid value",
                        keyword: err.keyword,
                        params: err.params as Record<string, unknown>,
                    });
                }
            }
        }
    }

    for (const q of route.args.query) {
        let value = q.serialization?.style === "deepObject" ? deepValues[q.name] : req.query[q.name];
        if (q.content === "application/json" && typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                errors.push({
                    path: `#/query/${q.name}`,
                    message: "Invalid JSON string",
                    keyword: "json",
                    params: {},
                });
                continue;
            }
    }
    }

    return errors.length > 0 ? errors : null;
}

/**
 * Validates a request against the OpenAPI schema
 * 
 * @param route - The bound route configuration
 * @param req - The Express request object
 * @param openapi - The OpenAPI specification
 * @param validator - The AJV validator instance
 * @returns Array of validation errors, or null if validation passes
 */
export function validateRequest(
    route: BoundRoute,
    req: Request,
    openapi: OpenAPI31,
    validator: ReturnType<typeof createValidator>
): ValidationError[] | null {
    const openapiOperation = getOpenApiOperation(openapi, route);
    const paramSchemaIndex = getParamSchemaIndex(openapiOperation);
    const deepNames = new Set(route.args.query.filter(q => q.serialization?.style === "deepObject").map(q => q.name));
    const deepValues = deepNames.size > 0
        ? parseDeepObjectParams(getRawQueryString(req), deepNames)
        : {};

    const errors: ValidationError[] = [];

    if (route.args.body) {
        const bodySchema = getSchemaByRef(openapi, route.args.body.schemaRef);
        if (bodySchema) {
            const validate = validator.compile(bodySchema);
            const valid = validate(req.body);
            if (!valid) {
                for (const err of validate.errors || []) {
                    errors.push({
                        path: `#/body${err.instancePath}`,
                        message: err.message || "Invalid value",
                        keyword: err.keyword,
                        params: err.params as Record<string, unknown>,
                    });
                }
            }
        }
    }

    for (const q of route.args.query) {
        let value = q.serialization?.style === "deepObject" ? deepValues[q.name] : req.query[q.name];
        if (q.content === "application/json" && typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                errors.push({
                    path: `#/query/${q.name}`,
                    message: "Invalid JSON string",
                    keyword: "json",
                    params: {},
                });
                continue;
            }
        }
        const openapiSchema = getParamSchemaFromIndex(paramSchemaIndex, "query", q.name);
        let schema: Record<string, unknown> = {};

        if (openapiSchema) {
            schema = resolveSchema(openapiSchema, openapi.components.schemas);
        } else {
            if (q.schemaType) {
                const type = Array.isArray(q.schemaType) ? q.schemaType[0] : q.schemaType;
                schema.type = type;
            }

            if (q.schemaRef && q.schemaRef.includes("Inline")) {
                const inlineSchema = getSchemaByRef(openapi, q.schemaRef);
                if (inlineSchema) {
                    Object.assign(schema, inlineSchema);
                }
            }
        }

        const coerced = coerceParamValue(value, schema, { dateTime: false, date: false }, openapi.components.schemas);

        if (Object.keys(schema).length > 0 && coerced !== undefined) {
            const validate = validator.compile(schema);
            const valid = validate(coerced);
            if (!valid) {
                for (const err of validate.errors || []) {
                    errors.push({
                        path: `#/query/${q.name}`,
                        message: err.message || "Invalid value",
                        keyword: err.keyword,
                        params: err.params as Record<string, unknown>,
                    });
                }
            }
        }
    }

    for (const p of route.args.path) {
        const value = req.params[p.name];
        const openapiSchema = getParamSchemaFromIndex(paramSchemaIndex, "path", p.name);
        let schema: Record<string, unknown> = {};

        if (openapiSchema) {
            schema = resolveSchema(openapiSchema, openapi.components.schemas);
        } else {
            if (p.schemaType) {
                const type = Array.isArray(p.schemaType) ? p.schemaType[0] : p.schemaType;
                schema.type = type;
            }

            if (p.schemaRef && p.schemaRef.includes("Inline")) {
                const inlineSchema = getSchemaByRef(openapi, p.schemaRef);
                if (inlineSchema) {
                    Object.assign(schema, inlineSchema);
                }
            }
        }

        const coerced = coerceParamValue(value, schema, { dateTime: false, date: false }, openapi.components.schemas);

        if (Object.keys(schema).length > 0 && coerced !== undefined) {
            const validate = validator.compile(schema);
            const valid = validate(coerced);
            if (!valid) {
                for (const err of validate.errors || []) {
                    errors.push({
                        path: `#/path/${p.name}`,
                        message: err.message || "Invalid value",
                        keyword: err.keyword,
                        params: err.params as Record<string, unknown>,
                    });
                }
            }
        }
    }

    return errors.length > 0 ? errors : null;
}
