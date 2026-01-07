import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { join } from "node:path";
import { bindRoutes } from "./merge.js";
import { createValidator, formatValidationErrors } from "../../runtime/validation/ajv.js";
import { loadArtifacts } from "../../compiler/cache/loadArtifacts.js";
import type { ManifestV1 } from "../../compiler/manifest/format.js";
import type { OpenAPI31, CreateRouterOptions } from "./types.js";
import {
    getOpenApiOperation,
    getParamSchemaIndex,
    getRequestBodySchema,
    getSchemaByRef,
    getParamSchemaFromIndex,
    schemaFromType
} from "./openapi.js";
import {
    normalizeCoerceOptions,
    getDateCoercionOptions,
    coerceDatesWithSchema,
    coerceParamValue,
    parseQueryValue,
    parseCookies,
    normalizeSort
} from "./coercion.js";
import { createAuthMiddleware } from "./auth.js";
import { validateRequest, validateRequestWithPrecompiled } from "./validation.js";

/**
 * Creates an Express router with Adorn API controllers
 * 
 * @param options - Router configuration options
 * @returns Promise that resolves with the configured Express router
 */
export async function createExpressRouter(options: CreateRouterOptions): Promise<Router> {
    const { controllers, artifactsDir = ".adorn", middleware = {}, defaultPageSize = 10 } = options;

    let manifest: ManifestV1;
    let openapi: OpenAPI31;
    let precompiledValidators: Record<string, { body?: (data: unknown) => boolean; response: Record<string, (data: unknown) => boolean> }> | null = null;

    if (options.manifest && options.openapi) {
        manifest = options.manifest;
        openapi = options.openapi;
        if (manifest.validation.mode === "precompiled" && manifest.validation.precompiledModule) {
            try {
                const validatorPath = join(artifactsDir, manifest.validation.precompiledModule);
                precompiledValidators = require(validatorPath).validators;
            } catch (err) {
                console.warn(`Failed to load precompiled validators: ${err}`);
            }
        }
    } else {
        const artifacts = await loadArtifacts({ outDir: artifactsDir });
        manifest = artifacts.manifest as unknown as ManifestV1;
        openapi = artifacts.openapi as unknown as OpenAPI31;
        precompiledValidators = artifacts.validators?.validators as Record<string, { body?: (data: unknown) => boolean; response: Record<string, (data: unknown) => boolean> }> ?? null;
    }

    const routes = bindRoutes({ controllers, manifest });
    const validator = precompiledValidators ? null : createValidator();
    const router = Router();
    const instanceCache = new Map<Function, any>();
    const coerce = normalizeCoerceOptions(options.coerce);

    function getInstance(Ctor: new (...args: any[]) => any): any {
        if (!instanceCache.has(Ctor)) {
            instanceCache.set(Ctor, new Ctor());
        }
        return instanceCache.get(Ctor);
    }

    function resolveMiddleware(
        items: Array<string | ((req: any, res: any, next: (err?: any) => void) => any)>,
        named: Record<string, (req: any, res: any, next: (err?: any) => void) => any> = {}
    ): Array<(req: any, res: any, next: (err?: any) => void) => any> {
        return items.map(item => {
            if (typeof item === "string") {
                const fn = named[item];
                if (!fn) {
                    throw new Error(`Named middleware "${item}" not found in middleware registry`);
                }
                return fn;
            }
            return item;
        });
    }

    for (const route of routes) {
        const method = route.httpMethod.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
        const openapiOperation = getOpenApiOperation(openapi, route);
        const paramSchemaIndex = getParamSchemaIndex(openapiOperation);
        const bodySchema = getRequestBodySchema(openapiOperation, route.args.body?.contentType)
            ?? (route.args.body ? getSchemaByRef(openapi, route.args.body.schemaRef) : null);
        const coerceBodyDates = getDateCoercionOptions(coerce, "body");
        const coerceQueryDates = getDateCoercionOptions(coerce, "query");
        const coercePathDates = getDateCoercionOptions(coerce, "path");
        const coerceHeaderDates = getDateCoercionOptions(coerce, "header");
        const coerceCookieDates = getDateCoercionOptions(coerce, "cookie");

        const middlewareChain: Array<(req: any, res: any, next: (err?: any) => void) => any> = [];

        if (middleware.global) {
            middlewareChain.push(...resolveMiddleware(middleware.global, middleware.named || {}));
        }

        if (route.controllerUse) {
            middlewareChain.push(...resolveMiddleware(route.controllerUse, middleware.named || {}));
        }

        if (route.use) {
            middlewareChain.push(...resolveMiddleware(route.use, middleware.named || {}));
        }

        if (options.auth) {
            const authMw = createAuthMiddleware(options.auth, route.auth, openapi.security || []);
            middlewareChain.push(authMw);
        }

        (router as any)[method](route.fullPath, ...middlewareChain, async (req: Request, res: Response, next: NextFunction) => {
            try {
                const validationErrors = precompiledValidators
                    ? validateRequestWithPrecompiled(route, req, precompiledValidators)
                    : validateRequest(route, req, openapi, validator!);

                if (validationErrors) {
                    return res.status(400).json(formatValidationErrors(validationErrors));
                }

                const instance = getInstance(route.controllerCtor);
                const handler = instance[route.methodName];

                if (typeof handler !== "function") {
                    throw new Error(`Method ${route.methodName} not found on controller`);
                }

                const args: any[] = [];

                if (route.args.body) {
                    const coercedBody = (coerceBodyDates.date || coerceBodyDates.dateTime) && bodySchema
                        ? coerceDatesWithSchema(req.body, bodySchema, coerceBodyDates, openapi.components.schemas)
                        : req.body;
                    args[route.args.body.index] = coercedBody;
                }

                for (const pathArg of route.args.path) {
                    const rawValue = req.params[pathArg.name];
                    const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "path", pathArg.name)
                        ?? (pathArg.schemaRef ? getSchemaByRef(openapi, pathArg.schemaRef) : null)
                        ?? schemaFromType(pathArg.schemaType);
                    const coerced = coerceParamValue(rawValue, paramSchema, coercePathDates, openapi.components.schemas);
                    args[pathArg.index] = coerced;
                }

                if (route.args.query.length > 0) {
                    const jsonArgs = route.args.query.filter(q => q.content === "application/json");
                    const standardArgs = route.args.query.filter(q => q.content !== "application/json");

                    const queryArgIndex = standardArgs[0]?.index;
                    if (queryArgIndex !== undefined) {
                        args[queryArgIndex] = {};
                    }

                    if (jsonArgs.length > 0) {
                        for (const q of jsonArgs) {
                            const rawValue = req.query[q.name];
                            if (rawValue === undefined || rawValue === null) continue;

                            let parsed: any = rawValue;
                            if (typeof rawValue === "string" && rawValue.length > 0) {
                                try {
                                    parsed = JSON.parse(rawValue);
                                } catch {
                                    parsed = rawValue;
                                }
                            }
                            const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "query", q.name)
                                ?? (q.schemaRef ? getSchemaByRef(openapi, q.schemaRef) : null)
                                ?? schemaFromType(q.schemaType);
                            const coerced = coerceParamValue(parsed, paramSchema, coerceQueryDates, openapi.components.schemas);

                            if (!args[q.index] || typeof args[q.index] !== "object") {
                                args[q.index] = {};
                            }
                            Object.assign(args[q.index], coerced);
                        }
                    }

                    if (standardArgs.length > 0) {
                        for (const q of standardArgs) {
                            const rawValue = req.query[q.name];
                            if (rawValue === undefined) continue;

                            const parsed = parseQueryValue(rawValue, q);
                            const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "query", q.name)
                                ?? (q.schemaRef ? getSchemaByRef(openapi, q.schemaRef) : null)
                                ?? schemaFromType(q.schemaType);
                            const coerced = coerceParamValue(parsed, paramSchema, coerceQueryDates, openapi.components.schemas);

                            if (!args[q.index] || typeof args[q.index] !== "object") {
                                args[q.index] = {};
                            }
                            (args[q.index] as Record<string, unknown>)[q.name] = coerced;
                        }
                    }

                    if (queryArgIndex !== undefined && args[queryArgIndex]) {
                        const queryObj = args[queryArgIndex] as Record<string, unknown>;
                        
                        if (queryObj.page === undefined) {
                            queryObj.page = 1;
                        }
                        if (queryObj.pageSize === undefined) {
                            queryObj.pageSize = defaultPageSize;
                        }

                        if (queryObj.sort) {
                            queryObj.sort = normalizeSort(queryObj.sort);
                        }
                    }
                }
 
                if (route.args.headers.length > 0) {
                    const firstHeaderIndex = route.args.headers[0].index;
                    const allSameIndex = route.args.headers.every(h => h.index === firstHeaderIndex);

                    if (allSameIndex) {
                        args[firstHeaderIndex] = {};
                        for (const h of route.args.headers) {
                            const headerValue = req.headers[h.name.toLowerCase()];
                            const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "header", h.name)
                                ?? (h.schemaRef ? getSchemaByRef(openapi, h.schemaRef) : null)
                                ?? schemaFromType(h.schemaType);
                            const coerced = coerceParamValue(headerValue, paramSchema, coerceHeaderDates, openapi.components.schemas);
                            args[firstHeaderIndex][h.name] = coerced ?? undefined;
                        }
                    } else {
                        for (const h of route.args.headers) {
                            const headerValue = req.headers[h.name.toLowerCase()];
                            const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "header", h.name)
                                ?? (h.schemaRef ? getSchemaByRef(openapi, h.schemaRef) : null)
                                ?? schemaFromType(h.schemaType);
                            const coerced = coerceParamValue(headerValue, paramSchema, coerceHeaderDates, openapi.components.schemas);
                            args[h.index] = coerced ?? undefined;
                        }
                    }
                }

                if (route.args.cookies.length > 0) {
                    const firstCookieIndex = route.args.cookies[0].index;
                    const allSameIndex = route.args.cookies.every(c => c.index === firstCookieIndex);
                    const cookies = parseCookies(req.headers.cookie as string | undefined);

                    if (allSameIndex) {
                        args[firstCookieIndex] = {};
                        for (const c of route.args.cookies) {
                            const cookieValue = cookies[c.name];
                            const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "cookie", c.name)
                                ?? (c.schemaRef ? getSchemaByRef(openapi, c.name) : null)
                                ?? schemaFromType(c.schemaType);
                            const coerced = coerceParamValue(cookieValue, paramSchema, coerceCookieDates, openapi.components.schemas);
                            args[firstCookieIndex][c.name] = coerced;
                        }
                    } else {
                        for (const c of route.args.cookies) {
                            const cookieValue = cookies[c.name];
                            const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "cookie", c.name)
                                ?? (c.schemaRef ? getSchemaByRef(openapi, c.name) : null)
                                ?? schemaFromType(c.schemaType);
                            const coerced = coerceParamValue(cookieValue, paramSchema, coerceCookieDates, openapi.components.schemas);
                            args[c.index] = coerced;
                        }
                    }
                }

                if (args.length === 0) {
                    args.push(req);
                }

                const result = await handler.apply(instance, args);

                const primaryResponse = route.responses[0];
                const status = primaryResponse?.status ?? 200;

                res.status(status).json(result);
            } catch (error) {
                next(error);
            }
        });
    }

    return router;
}
