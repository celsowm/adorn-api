import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ManifestV1 } from "../../compiler/manifest/format.js";
import { bindRoutes } from "./merge.js";
import type { BoundRoute } from "./merge.js";
import { createValidator, formatValidationErrors } from "../../runtime/validation/ajv.js";

interface OpenAPI31 {
  openapi: string;
  components: {
    schemas: Record<string, Record<string, unknown>>;
  };
}

export interface CreateRouterOptions {
  controllers: Array<new (...args: any[]) => any>;
  artifactsDir?: string;
  manifest?: ManifestV1;
  openapi?: OpenAPI31;
}

export function createExpressRouter(options: CreateRouterOptions): Router {
  const { controllers, artifactsDir = ".adorn" } = options;

  const manifest: ManifestV1 = options.manifest ?? JSON.parse(
    readFileSync(resolve(artifactsDir, "manifest.json"), "utf-8")
  );

  const openapi: OpenAPI31 = options.openapi ?? JSON.parse(
    readFileSync(resolve(artifactsDir, "openapi.json"), "utf-8")
  );

  const routes = bindRoutes({ controllers, manifest });

  const validator = createValidator();

  const router = Router();

  const instanceCache = new Map<Function, any>();

  function getInstance(Ctor: new (...args: any[]) => any): any {
    if (!instanceCache.has(Ctor)) {
      instanceCache.set(Ctor, new Ctor());
    }
    return instanceCache.get(Ctor);
  }

  function getSchemaByRef(ref: string): Record<string, unknown> | null {
    if (!ref.startsWith("#/components/schemas/")) return null;
    const schemaName = ref.replace("#/components/schemas/", "");
    return openapi.components.schemas[schemaName] || null;
  }

  for (const route of routes) {
    const method = route.httpMethod.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";

    router[method](route.fullPath, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validationErrors = validateRequest(route, req, openapi, validator);
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
              const coerced = coerceValue(req.query[q.name], q.schemaType);
              args[firstQueryIndex][q.name] = coerced;
            }
          } else {
            for (const q of route.args.query) {
              const coerced = coerceValue(req.query[q.name], q.schemaType);
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
