import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ManifestV1 } from "../../compiler/manifest/format.js";
import { bindRoutes, type BoundRoute } from "./merge.js";
import { createValidator, formatValidationErrors } from "../../runtime/validation/ajv.js";
import type { AuthSchemeRuntime } from "../../runtime/auth/runtime.js";
import { loadArtifacts } from "../../compiler/cache/loadArtifacts.js";

interface OpenAPI31 {
  openapi: string;
  components: {
    schemas: Record<string, Record<string, unknown>>;
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
  security?: Array<Record<string, string[]>>;
}

interface AuthenticatedRequest extends Request {
  auth?: any;
}

export interface CreateRouterOptions {
  controllers: Array<new (...args: any[]) => any>;
  artifactsDir?: string;
  manifest?: ManifestV1;
  openapi?: OpenAPI31;
  auth?: {
    schemes: Record<string, AuthSchemeRuntime>;
  };
  middleware?: {
    global?: Array<string | ((req: any, res: any, next: (err?: any) => void) => any)>;
    named?: Record<string, (req: any, res: any, next: (err?: any) => void) => any>;
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
          args[route.args.body.index] = req.body;
        }

        for (const pathArg of route.args.path) {
          const coerced = coerceValue(req.params[pathArg.name], pathArg.schemaType);
          args[pathArg.index] = coerced;
        }

        if (route.args.query.length > 0) {
          const firstQueryIndex = route.args.query[0].index;
          const allSameIndex = route.args.query.every(q => q.index === firstQueryIndex);

          if (allSameIndex) {
            args[firstQueryIndex] = {};
            for (const q of route.args.query) {
              const parsed = parseQueryValue(req.query[q.name], q);
              const coerced = coerceValue(parsed, q.schemaType);
              args[firstQueryIndex][q.name] = coerced;
            }
          } else {
            for (const q of route.args.query) {
              const parsed = parseQueryValue(req.query[q.name], q);
              const coerced = coerceValue(parsed, q.schemaType);
              args[q.index] = coerced;
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
              args[firstHeaderIndex][h.name] = headerValue ?? undefined;
            }
          } else {
            for (const h of route.args.headers) {
              const headerValue = req.headers[h.name.toLowerCase()];
              args[h.index] = headerValue ?? undefined;
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
              const coerced = coerceValue(cookieValue, c.schemaType);
              args[firstCookieIndex][c.name] = coerced;
            }
          } else {
            for (const c of route.args.cookies) {
              const cookieValue = cookies[c.name];
              const coerced = coerceValue(cookieValue, c.schemaType);
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
    const value = req.query[q.name];
    if (value === undefined) continue;

    const schema: Record<string, unknown> = {};
    if (q.schemaType) {
      const type = Array.isArray(q.schemaType) ? q.schemaType[0] : q.schemaType;
      schema.type = type;
    }

    const coerced = coerceValue(value, q.schemaType);
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

    const schema: Record<string, unknown> = {};
    if (p.schemaType) {
      const type = Array.isArray(p.schemaType) ? p.schemaType[0] : p.schemaType;
      schema.type = type;
    }

    const coerced = coerceValue(value, p.schemaType);
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
    const value = req.query[q.name];
    const schema: Record<string, unknown> = {};

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

    const coerced = coerceValue(value, q.schemaType);

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
    const schema: Record<string, unknown> = {};

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

    const coerced = coerceValue(value, p.schemaType);

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

function coerceValue(value: any, schemaType?: string | string[]): any {
  if (value === undefined || value === null) return value;

  const type = Array.isArray(schemaType) ? schemaType[0] : schemaType;

  if (type === "number" || type === "integer") {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }
    return num;
  }

  if (type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`Invalid boolean: ${value}`);
  }

  return value;
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
