import type { IncomingMessage, ServerResponse } from "node:http";
import type { Constructor, RequestContext } from "../../core/types";
import type { SchemaSource } from "../../core/schema";
import { getControllerMeta } from "../../core/metadata";
import { getRouteAuthMeta } from "../../core/auth";
import { isHttpError, HttpError } from "../../core/errors";
import { isHttpResponse } from "../../core/response";
import type { InputCoercionSetting, ValidationOptions, RequestContext as NativeRequestContext } from "./types";
import { createInputCoercer } from "./coercion";
import { serializeResponse } from "./response-serializer";
import { lifecycleRegistry } from "../../core/lifecycle";
import { createSseEmitter, createStreamWriter } from "../../core/streaming";
import { validate } from "../../core/validation";
import { ValidationErrors, isValidationErrors } from "../../core/validation-errors";
import { Router } from "./router";

/**
 * Registers controllers with a native application router.
 */
export async function registerControllers(
  router: Router,
  controllers: Constructor[]
): Promise<void> {
  for (const controller of controllers) {
    const meta = getControllerMeta(controller);
    if (!meta) {
      throw new Error(`Controller "${controller.name}" is missing @Controller decorator.`);
    }
    const instance = new controller();
    lifecycleRegistry.register(instance);
    await lifecycleRegistry.callOnModuleInit(instance);

    for (const route of meta.routes) {
      router.add(instance, route, meta.basePath);
    }
  }
}

/**
 * Dispatches a native request to the appropriate controller handler.
 */
export async function dispatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  match: any,
  options: {
    inputCoercion: InputCoercionSetting;
    validation?: boolean | ValidationOptions;
    body?: any;
    query?: Record<string, any>;
  }
): Promise<void> {
  const { controller: instance, route, params: rawParams } = match;
  const { inputCoercion, validation, body: rawBody, query: rawQuery } = options;

  const handler = instance[route.handlerName];
  if (typeof handler !== "function") {
    throw new Error(`Handler "${String(route.handlerName)}" is not a function.`);
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
  const coerceBody = inputCoercion === false
    ? undefined
    : createInputCoercer<Record<string, any>>(route.body, { mode: inputCoercion, location: "body" });

  const isValidationEnabled = validation !== false && (validation as ValidationOptions)?.enabled !== false;

  const authMeta = getRouteAuthMeta(instance.constructor as Constructor, route.handlerName);

  try {
    // Apply auth guard if metadata exists
    if (authMeta && authMeta.requiresAuth && !authMeta.isPublic) {
      const user = (req as any).user;
      if (!user) {
        throw new HttpError(401, "Unauthorized");
      }

      if (authMeta.roles?.length) {
        const hasRole = authMeta.roles.some((role: string) => user.roles?.includes(role));
        if (!hasRole) {
          throw new HttpError(403, "Insufficient permissions");
        }
      }

      if (authMeta.allRoles?.length) {
        const hasAllRoles = authMeta.allRoles.every((role: string) => user.roles?.includes(role));
        if (!hasAllRoles) {
          throw new HttpError(403, "Insufficient permissions");
        }
      }

      if (authMeta.guard) {
        const allowed = await authMeta.guard(user, req);
        if (!allowed) {
          throw new HttpError(403, "Access denied by guard");
        }
      }
    }

    const body = (coerceBody && rawBody) ? coerceBody(rawBody) : rawBody;
    const query = (coerceQuery && rawQuery) ? coerceQuery(rawQuery) : rawQuery;
    const params = (coerceParams && rawParams) ? coerceParams(rawParams) : rawParams;

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
      res,
      body,
      query,
      params,
      headers: req.headers,
      files: undefined, // Native adapter doesn't support multipart yet
      sse: route.sse ? createSseEmitter(res) : undefined,
      stream: route.streaming || route.sse ? createStreamWriter(res) : undefined
    } as unknown as NativeRequestContext;

    const result = await (handler as (...args: any[]) => any).call(instance, ctx);

    if (res.writableEnded || route.sse || route.streaming) {
      return;
    }

    if (isHttpResponse(result)) {
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        }
      }

      if (result.body === undefined) {
        res.statusCode = result.status;
        res.end();
      } else if (route.raw) {
        if (!res.getHeader("Content-Type")) {
          const ct = getResponseContentType(route) ?? "application/octet-stream";
          res.setHeader("Content-Type", ct);
        }
        res.statusCode = result.status;
        res.end(result.body);
      } else {
        const responseSchema = getResponseSchemaForStatus(route, result.status);
        const output = responseSchema ? serializeResponse(result.body, responseSchema) : result.body;
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(output));
      }
      return;
    }

    if (result === undefined) {
      res.statusCode = defaultStatus(route);
      res.end();
      return;
    }

    if (route.raw) {
      if (!res.getHeader("Content-Type")) {
        const ct = getResponseContentType(route) ?? "application/octet-stream";
        res.setHeader("Content-Type", ct);
      }
      res.statusCode = defaultStatus(route);
      res.end(result);
    } else {
      const responseSchema = getResponseSchema(route);
      const output = responseSchema ? serializeResponse(result, responseSchema) : result;
      res.statusCode = defaultStatus(route);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(output));
    }
  } catch (error) {
    if (isValidationErrors(error)) {
      res.statusCode = error.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(error.body));
      return;
    }
    if (isHttpError(error)) {
      if (error.headers) {
        for (const [key, value] of Object.entries(error.headers)) {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        }
      }
      const body = error.body ?? { message: error.message };
      res.statusCode = error.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
      return;
    }

    console.error("Unhandled error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Internal server error" }));
  }
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
