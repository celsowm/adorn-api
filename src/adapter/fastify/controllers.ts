import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Constructor } from "../../core/types";
import type { SchemaSource } from "../../core/schema";
import { getControllerMeta } from "../../core/metadata";
import { assertRouteAuthorized, getRouteAuthMeta } from "../../core/auth";
import { isHttpError } from "../../core/errors";
import { isHttpResponse } from "../../core/response";
import type {
  InputCoercionSetting,
  MultipartOptions,
  RequestContext as FastifyRequestContext,
  ValidationOptions
} from "./types";
import type { CacheProvider } from "../../core/cache";
import { createInputCoercer } from "./coercion";
import { serializeResponse } from "./response-serializer";
import {
  extractFiles,
  hasFileUploads,
  normalizeMultipartOptions
} from "./multipart";
import { lifecycleRegistry } from "../../core/lifecycle";
import { createSseEmitter, createStreamWriter } from "../../core/streaming";
import { validate } from "../../core/validation";
import { ValidationErrors, isValidationErrors } from "../../core/validation-errors";
import {
  resolveCacheProvider,
  buildCacheKey,
  shouldCacheResult,
  isCacheableMethod,
  getCacheOptions
} from "../../core/cache-utils";

/**
 * Attaches controllers to a Fastify application.
 */
export async function attachControllers(
  app: FastifyInstance,
  controllers: Constructor[],
  inputCoercion: InputCoercionSetting = "safe",
  multipart?: boolean | MultipartOptions,
  validation?: boolean | ValidationOptions,
  auth?: { userProperty?: string },
  cacheProvider?: CacheProvider
): Promise<void> {
  const multipartOptions = normalizeMultipartOptions(multipart);
  const cache = cacheProvider ? resolveCacheProvider(cacheProvider) : undefined;

  for (const controller of controllers) {
    const meta = getControllerMeta(controller);
    if (!meta) {
      throw new Error(`Controller "${controller.name}" is missing @Controller decorator.`);
    }
    const instance = new controller();
    lifecycleRegistry.register(instance);
    await lifecycleRegistry.callOnModuleInit(instance);

    for (const route of meta.routes) {
      const path = joinPaths(meta.basePath, route.path);
      const handler = instance[route.handlerName as keyof typeof instance];

      if (typeof handler !== "function") {
        throw new Error(`Handler "${String(route.handlerName)}" is not a function on ${controller.name}.`);
      }

      const coerceParams = inputCoercion === false
        ? undefined
        : createInputCoercer<Record<string, any>>(
          route.params,
          { mode: inputCoercion, location: "params" }
        );
      const coerceQuery = inputCoercion === false
        ? undefined
        : createInputCoercer<Record<string, any>>(route.query, { mode: inputCoercion, location: "query" });
      const coerceQueryString = inputCoercion === false
        ? undefined
        : createInputCoercer<Record<string, any>>(route.querystring, { mode: inputCoercion, location: "query" });
      const isValidationEnabled = validation !== false && (validation as ValidationOptions)?.enabled !== false;
      const routeCache = cache && isCacheableMethod(route.httpMethod) ? getCacheOptions(route) : undefined;

      const authMeta = getRouteAuthMeta(controller, route.handlerName);
      ensureFastifyMethod(app, route.httpMethod, Boolean(route.body || route.files?.length));

      app.route({
        method: route.httpMethod.toUpperCase() as any,
        url: path,
        handler: async (req: FastifyRequest, reply: FastifyReply) => {
          try {
            // Apply auth guard if metadata exists
            await assertRouteAuthorized(authMeta, req, auth);

            let files: any = undefined;
            if (multipartOptions && hasFileUploads(route.files)) {
              files = await extractFiles(req);
            }

            const body = req.body;
            const query = (coerceQuery && req.query && Object.keys(req.query as any).length > 0) ? coerceQuery(req.query as any) : req.query;
            const rawQueryString = getRawQueryString(req.url);
            const parsedQueryString = getQueryStringValue(route.querystring, rawQueryString);
            const querystring = coerceQueryString && isRecord(parsedQueryString)
              ? coerceQueryString(parsedQueryString)
              : parsedQueryString;
            const params = (coerceParams && req.params && Object.keys(req.params as any).length > 0) ? coerceParams(req.params as any) : req.params;

            // Try cache lookup
            if (routeCache && cache) {
              const cacheKey = buildCacheKey(
                route.httpMethod,
                path,
                routeCache,
                req.params as Record<string, unknown>
              );
              const cached = await cache.get(cacheKey);
              if (cached !== undefined) {
                return reply.send(cached);
              }
            }

            if (isValidationEnabled) {
              const validationErrors = [];

              if (route.body) {
                const bodyErrors = validate(body, route.body.schema);
                validationErrors.push(...bodyErrors);
              }

              if (route.query) {
                const queryErrors = validate(query, route.query.schema);
                validationErrors.push(...queryErrors);
              }

              if (route.querystring) {
                const queryStringErrors = validate(querystring, route.querystring.schema);
                validationErrors.push(...queryStringErrors);
              }

              if (route.params) {
                const paramsErrors = validate(params, route.params.schema);
                validationErrors.push(...paramsErrors);
              }

              if (route.headers) {
                const headersErrors = validate(req.headers, route.headers.schema);
                validationErrors.push(...headersErrors);
              }

              if (validationErrors.length > 0) {
                throw new ValidationErrors(validationErrors);
              }
            }

            const ctx = {
              req,
              res: reply.raw,
              body,
              query,
              querystring,
              params,
              headers: req.headers,
              files,
              sse: route.sse ? createSseEmitter(reply.raw) : undefined,
              stream: route.streaming || route.sse ? createStreamWriter(reply.raw) : undefined
            } as unknown as FastifyRequestContext;

            const result = await (handler as (...args: any[]) => any).call(instance, ctx);

            if (reply.sent || route.sse || route.streaming) {
              return;
            }

            if (isHttpResponse(result)) {
              if (result.headers) {
                reply.headers(result.headers);
              }

              if (result.body === undefined) {
                reply.status(result.status).send();
              } else if (route.raw) {
                if (!reply.getHeader("Content-Type")) {
                  const ct = getResponseContentType(route) ?? "application/octet-stream";
                  reply.type(ct);
                }
                reply.status(result.status).send(result.body);
              } else {
                const responseSchema = getResponseSchemaForStatus(route, result.status);
                const output = responseSchema ? serializeResponse(result.body, responseSchema) : result.body;
                reply.status(result.status).send(output);
                if (routeCache && cache && shouldCacheResult(routeCache.condition, output)) {
                  const cacheKey = buildCacheKey(
                    route.httpMethod,
                    path,
                    routeCache,
                    req.params as Record<string, unknown>
                  );
                  await cache.set(cacheKey, output, routeCache.ttl);
                }
              }
              return;
            }

            if (result === undefined) {
              reply.status(defaultStatus(route)).send();
              return;
            }

            if (route.raw) {
              if (!reply.getHeader("Content-Type")) {
                const ct = getResponseContentType(route) ?? "application/octet-stream";
                reply.type(ct);
              }
              reply.status(defaultStatus(route)).send(result);
            } else {
              const responseSchema = getResponseSchema(route);
              const output = responseSchema ? serializeResponse(result, responseSchema) : result;
              reply.status(defaultStatus(route)).send(output);
              if (routeCache && cache && shouldCacheResult(routeCache.condition, output)) {
                const cacheKey = buildCacheKey(
                  route.httpMethod,
                  path,
                  routeCache,
                  req.params as Record<string, unknown>
                );
                await cache.set(cacheKey, output, routeCache.ttl);
              }
            }
          } catch (error) {
            if (isValidationErrors(error)) {
              reply.status(error.status).send(error.body);
              return;
            }
            if (isHttpError(error)) {
              if (error.headers) {
                reply.headers(error.headers);
              }
              const body = error.body ?? { message: error.message };
              reply.status(error.status).send(body);
              return;
            }
            throw error;
          }
        }
      });
    }
  }
}

function ensureFastifyMethod(app: FastifyInstance, method: string, hasBody: boolean): void {
  const upper = method.toUpperCase();
  if (app.supportedMethods.includes(upper)) {
    return;
  }
  app.addHttpMethod(upper, { hasBody });
}

function getRawQueryString(url: string): string {
  const index = url.indexOf("?");
  return index >= 0 ? url.slice(index + 1) : "";
}

function getQueryStringValue(input: { contentType?: string } | undefined, raw: string): string | Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }
  if ((input.contentType ?? "application/x-www-form-urlencoded") !== "application/x-www-form-urlencoded") {
    return raw;
  }
  return parseFormUrlEncoded(raw);
}

function parseFormUrlEncoded(raw: string): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const params = new URLSearchParams(raw);
  params.forEach((value, key) => {
    const current = output[key];
    if (current === undefined) {
      output[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      output[key] = [current, value];
    }
  });
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function defaultStatus(route: {
  responses?: Array<{ status: number; error?: boolean }>;
}): number {
  const responses = route.responses ?? [];
  const success = responses.find(
    (response) => !response.error && response.status < 400
  );
  return success?.status ?? 200;
}

function getResponseSchema(route: {
  responses?: Array<{ status: number; error?: boolean; schema?: SchemaSource }>;
}): SchemaSource | undefined {
  const responses = route.responses ?? [];
  const success = responses.find((response) => !response.error && response.status < 400);
  return success?.schema;
}

function getResponseContentType(route: {
  responses?: Array<{ status: number; error?: boolean; contentType?: string }>;
}): string | undefined {
  const responses = route.responses ?? [];
  const success = responses.find((r) => !r.error && r.status < 400);
  return success?.contentType;
}

function getResponseSchemaForStatus(
  route: {
    responses?: Array<{ status: number; error?: boolean; schema?: SchemaSource }>;
  },
  status: number
): SchemaSource | undefined {
  const responses = route.responses ?? [];
  const response = responses.find((r) => r.status === status);
  return response?.schema;
}

function joinPaths(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
