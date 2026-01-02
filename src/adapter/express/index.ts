import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import type { ManifestV1 } from "../../compiler/manifest/format.js";
import { bindRoutes, type BoundRoute } from "./merge.js";
import { createValidator, formatValidationErrors } from "../../runtime/validation/ajv.js";
import type { AuthSchemeRuntime } from "../../runtime/auth/runtime.js";
import { loadArtifacts } from "../../compiler/cache/loadArtifacts.js";
import swaggerUi from "swagger-ui-express";

interface OpenAPI31 {
  openapi: string;
  components: {
    schemas: Record<string, Record<string, unknown>>;
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
  paths?: Record<string, Record<string, any>>;
  security?: Array<Record<string, string[]>>;
}

interface AuthenticatedRequest extends Request {
  auth?: any;
}

export interface CoerceOptions {
  body?: boolean;
  query?: boolean;
  path?: boolean;
  header?: boolean;
  cookie?: boolean;
  dateTime?: boolean;
  date?: boolean;
}

export interface CreateRouterOptions {
  controllers: Array<new (...args: any[]) => any>;
  artifactsDir?: string;
  manifest?: ManifestV1;
  openapi?: OpenAPI31;
  auth?: {
    schemes: Record<string, AuthSchemeRuntime>;
  };
  coerce?: CoerceOptions;
  middleware?: {
    global?: Array<string | ((req: any, res: any, next: (err?: any) => void) => any)>;
    named?: Record<string, (req: any, res: any, next: (err?: any) => void) => any>;
  };
}

export interface SetupSwaggerOptions {
  artifactsDir?: string;
  jsonPath?: string;
  uiPath?: string;
  swaggerOptions?: {
    url?: string;
    servers?: Array<{ url: string; description?: string }>;
    [key: string]: any;
  };
}

function normalizeCoerceOptions(coerce?: CoerceOptions): Required<CoerceOptions> {
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

export async function createExpressRouter(options: CreateRouterOptions): Promise<Router> {
  const { controllers, artifactsDir = ".adorn", middleware = {} } = options;

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

  function createAuthMiddleware(
    authConfig: NonNullable<CreateRouterOptions["auth"]>,
    routeAuth: BoundRoute["auth"],
    globalSecurity: NonNullable<OpenAPI31["security"]>
  ) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const isPublic = routeAuth === "public";
      const hasAuthDecorator = routeAuth && routeAuth !== "public";
      const hasGlobalSecurity = globalSecurity && globalSecurity.length > 0;

      if (!hasAuthDecorator && !hasGlobalSecurity) {
        return next();
      }

      if (isPublic) {
        return next();
      }

      const authMeta = routeAuth as { scheme: string; scopes?: string[]; optional?: boolean };
      const scheme = authMeta.scheme;
      const requiredScopes = authMeta.scopes || [];
      const isOptional = authMeta.optional ?? false;

      const authRuntime = authConfig.schemes[scheme];
      if (!authRuntime) {
        throw new Error(`Auth scheme "${scheme}" not found in auth configuration`);
      }

      const result = await authRuntime.authenticate(req);

      if (!result) {
        if (isOptional) {
          req.auth = null;
          return next();
        }
        return authRuntime.challenge(res);
      }

      req.auth = result.principal;

      if (authRuntime.authorize && requiredScopes.length > 0) {
        if (!authRuntime.authorize(result, requiredScopes)) {
          res.status(403).json({ error: "Forbidden", message: "Insufficient scopes" });
          return;
        }
      }

      next();
    };
  }

  function getSchemaByRef(ref: string): Record<string, unknown> | null {
    if (!ref.startsWith("#/components/schemas/")) return null;
    const schemaName = ref.replace("#/components/schemas/", "");
    return openapi.components.schemas[schemaName] || null;
  }

  for (const route of routes) {
    const method = route.httpMethod.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
    const openapiOperation = getOpenApiOperation(openapi, route);
    const paramSchemaIndex = buildParamSchemaIndex(openapiOperation);
    const bodySchema = getRequestBodySchema(openapiOperation, route.args.body?.contentType)
      ?? (route.args.body ? getSchemaByRef(route.args.body.schemaRef) : null);
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

    router[method](route.fullPath, ...middlewareChain, async (req: Request, res: Response, next: NextFunction) => {
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
            ?? (pathArg.schemaRef ? getSchemaByRef(pathArg.schemaRef) : null)
            ?? schemaFromType(pathArg.schemaType);
          const coerced = coerceParamValue(rawValue, paramSchema, coercePathDates, openapi.components.schemas);
          args[pathArg.index] = coerced;
        }

        if (route.args.query.length > 0) {
          const deepObjectArgs = route.args.query.filter(q => q.serialization?.style === "deepObject");
          const standardArgs = route.args.query.filter(q => q.serialization?.style !== "deepObject");

          if (deepObjectArgs.length > 0) {
            const rawQuery = getRawQueryString(req);
            const names = new Set(deepObjectArgs.map(q => q.name));
            const parsedDeep = parseDeepObjectParams(rawQuery, names);

            for (const q of deepObjectArgs) {
              const rawValue = parsedDeep[q.name];
              const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "query", q.name)
                ?? (q.schemaRef ? getSchemaByRef(q.schemaRef) : null)
                ?? schemaFromType(q.schemaType);
              const baseValue = rawValue === undefined ? {} : rawValue;
              const coerced = coerceParamValue(baseValue, paramSchema, coerceQueryDates, openapi.components.schemas);
              args[q.index] = coerced;
            }
          }

          if (standardArgs.length > 0) {
            const firstQueryIndex = standardArgs[0].index;
            const allSameIndex = standardArgs.every(q => q.index === firstQueryIndex);

            if (allSameIndex) {
              args[firstQueryIndex] = {};
              for (const q of standardArgs) {
                const parsed = parseQueryValue(req.query[q.name], q);
                const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "query", q.name)
                  ?? (q.schemaRef ? getSchemaByRef(q.schemaRef) : null)
                  ?? schemaFromType(q.schemaType);
                const coerced = coerceParamValue(parsed, paramSchema, coerceQueryDates, openapi.components.schemas);
                args[firstQueryIndex][q.name] = coerced;
              }
            } else {
              for (const q of standardArgs) {
                const parsed = parseQueryValue(req.query[q.name], q);
                const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "query", q.name)
                  ?? (q.schemaRef ? getSchemaByRef(q.schemaRef) : null)
                  ?? schemaFromType(q.schemaType);
                const coerced = coerceParamValue(parsed, paramSchema, coerceQueryDates, openapi.components.schemas);
                args[q.index] = coerced;
              }
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
                ?? (h.schemaRef ? getSchemaByRef(h.schemaRef) : null)
                ?? schemaFromType(h.schemaType);
              const coerced = coerceParamValue(headerValue, paramSchema, coerceHeaderDates, openapi.components.schemas);
              args[firstHeaderIndex][h.name] = coerced ?? undefined;
            }
          } else {
            for (const h of route.args.headers) {
              const headerValue = req.headers[h.name.toLowerCase()];
              const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "header", h.name)
                ?? (h.schemaRef ? getSchemaByRef(h.schemaRef) : null)
                ?? schemaFromType(h.schemaType);
              const coerced = coerceParamValue(headerValue, paramSchema, coerceHeaderDates, openapi.components.schemas);
              args[h.index] = coerced ?? undefined;
            }
          }
        }

        if (route.args.cookies.length > 0) {
          const firstCookieIndex = route.args.cookies[0].index;
          const allSameIndex = route.args.cookies.every(c => c.index === firstCookieIndex);
          const cookies = parseCookies(req.headers.cookie);

          if (allSameIndex) {
            args[firstCookieIndex] = {};
            for (const c of route.args.cookies) {
              const cookieValue = cookies[c.name];
              const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "cookie", c.name)
                ?? (c.schemaRef ? getSchemaByRef(c.schemaRef) : null)
                ?? schemaFromType(c.schemaType);
              const coerced = coerceParamValue(cookieValue, paramSchema, coerceCookieDates, openapi.components.schemas);
              args[firstCookieIndex][c.name] = coerced;
            }
          } else {
            for (const c of route.args.cookies) {
              const cookieValue = cookies[c.name];
              const paramSchema = getParamSchemaFromIndex(paramSchemaIndex, "cookie", c.name)
                ?? (c.schemaRef ? getSchemaByRef(c.schemaRef) : null)
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

type CoerceLocation = "body" | "query" | "path" | "header" | "cookie";
type DateCoercionOptions = { dateTime: boolean; date: boolean };

function getDateCoercionOptions(
  coerce: Required<CoerceOptions>,
  location: CoerceLocation
): DateCoercionOptions {
  const enabled = coerce[location];
  return {
    dateTime: enabled && coerce.dateTime,
    date: enabled && coerce.date,
  };
}

function toOpenApiPath(path: string): string {
  return path.replace(/:([^/]+)/g, "{$1}");
}

function getOpenApiOperation(openapi: OpenAPI31, route: BoundRoute): any | null {
  const pathKey = toOpenApiPath(route.fullPath);
  const pathItem = openapi.paths?.[pathKey];
  if (!pathItem) return null;
  return pathItem[route.httpMethod.toLowerCase()] ?? null;
}

function buildParamSchemaIndex(operation: any | null): Map<string, Record<string, unknown>> {
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

function getParamSchemaFromIndex(
  index: Map<string, Record<string, unknown>>,
  location: "path" | "query" | "header" | "cookie",
  name: string
): Record<string, unknown> | null {
  return index.get(`${location}:${name}`) ?? null;
}

function getRequestBodySchema(operation: any | null, contentType?: string): Record<string, unknown> | null {
  const content = operation?.requestBody?.content;
  if (!content) return null;

  if (contentType && content[contentType]?.schema) {
    return content[contentType].schema;
  }

  const first = Object.values(content)[0] as Record<string, unknown> | undefined;
  return (first as any)?.schema ?? null;
}

function schemaFromType(schemaType?: string | string[]): Record<string, unknown> | null {
  if (!schemaType) return null;
  return { type: schemaType };
}

interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

function validateRequestWithPrecompiled(
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
    const value = q.serialization?.style === "deepObject" ? deepValues[q.name] : req.query[q.name];
    if (value === undefined) continue;

    const schema = schemaFromType(q.schemaType) ?? {};
    const coerced = coerceParamValue(value, schema, { dateTime: false, date: false }, {});
    if (Object.keys(schema).length > 0 && coerced !== undefined) {
      errors.push({
        path: `#/query/${q.name}`,
        message: `Schema validation not supported for query params in precompiled mode`,
        keyword: "notSupported",
        params: {},
      });
    }
  }

  for (const p of route.args.path) {
    const value = req.params[p.name];
    if (value === undefined) continue;

    const schema = schemaFromType(p.schemaType) ?? {};
    const coerced = coerceParamValue(value, schema, { dateTime: false, date: false }, {});
    if (Object.keys(schema).length > 0 && coerced !== undefined) {
      errors.push({
        path: `#/path/${p.name}`,
        message: `Schema validation not supported for path params in precompiled mode`,
        keyword: "notSupported",
        params: {},
      });
    }
  }

  return errors.length > 0 ? errors : null;
}

function validateRequest(
  route: BoundRoute,
  req: Request,
  openapi: OpenAPI31,
  validator: ReturnType<typeof createValidator>
): ValidationError[] | null {
  function getSchemaByRef(ref: string): Record<string, unknown> | null {
    if (!ref.startsWith("#/components/schemas/")) return null;
    const schemaName = ref.replace("#/components/schemas/", "");
    return openapi.components.schemas[schemaName] || null;
  }

  const openapiOperation = getOpenApiOperation(openapi, route);
  const paramSchemaIndex = buildParamSchemaIndex(openapiOperation);
  const deepNames = new Set(route.args.query.filter(q => q.serialization?.style === "deepObject").map(q => q.name));
  const deepValues = deepNames.size > 0
    ? parseDeepObjectParams(getRawQueryString(req), deepNames)
    : {};

  const errors: ValidationError[] = [];

  if (route.args.body) {
    const bodySchema = getSchemaByRef(route.args.body.schemaRef);
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
    const value = q.serialization?.style === "deepObject" ? deepValues[q.name] : req.query[q.name];
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
        const inlineSchema = getSchemaByRef(q.schemaRef);
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
        const inlineSchema = getSchemaByRef(p.schemaRef);
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

function resolveSchema(
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

function coerceDatesWithSchema(
  value: any,
  schema: Record<string, unknown> | null,
  dateCoercion: DateCoercionOptions,
  components: Record<string, Record<string, unknown>>
): any {
  if (!schema || (!dateCoercion.date && !dateCoercion.dateTime)) return value;
  return coerceWithSchema(value, schema, dateCoercion, components, { coercePrimitives: false });
}

function coerceParamValue(
  value: any,
  schema: Record<string, unknown> | null,
  dateCoercion: DateCoercionOptions,
  components: Record<string, Record<string, unknown>>
): any {
  if (!schema) return value;
  return coerceWithSchema(value, schema, dateCoercion, components, { coercePrimitives: true });
}

function coerceWithSchema(
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function parseQueryValue(value: any, param: { schemaType?: string | string[]; serialization?: { style?: string; explode?: boolean } }): any {
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

function getRawQueryString(req: Request): string {
  const url = req.originalUrl ?? req.url ?? "";
  const index = url.indexOf("?");
  if (index === -1) return "";
  return url.slice(index + 1);
}

function parseDeepObjectParams(
  rawQuery: string,
  names: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!rawQuery || names.size === 0) return out;

  const params = new URLSearchParams(rawQuery);
  for (const [key, value] of params.entries()) {
    const path = parseBracketPath(key);
    if (path.length === 0) continue;
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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
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

export { bootstrap, type BootstrapOptions } from "./bootstrap.js";

export function setupSwagger(options: SetupSwaggerOptions = {}): Router {
  const {
    artifactsDir = ".adorn",
    jsonPath = "/docs/openapi.json",
    uiPath = "/docs",
    swaggerOptions = {},
  } = options;

  const router = Router();

  router.get(jsonPath, (req, res) => {
    const openApiPath = isAbsolute(artifactsDir)
      ? resolve(artifactsDir, "openapi.json")
      : resolve(process.cwd(), artifactsDir, "openapi.json");
    
    const content = readFileSync(openApiPath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.send(content);
  });

  router.use(uiPath, swaggerUi.serve, swaggerUi.setup(null, {
    swaggerOptions: {
      url: jsonPath,
      ...swaggerOptions,
    },
  }));

  return router;
}
