import type { Express, Request, Response, NextFunction } from "express";
import type { Constructor } from "../../core/types";
import { getControllerMeta } from "../../core/metadata";
import { isHttpError, type HttpError } from "../../core/errors";
import type { InputCoercionSetting, MultipartOptions, RequestContext } from "./types";
import { createInputCoercer } from "./coercion";
import {
  createMultipartMiddleware,
  extractFiles,
  hasFileUploads,
  normalizeMultipartOptions
} from "./multipart";
import { lifecycleRegistry } from "../../core/lifecycle";
import { createSseEmitter, createStreamWriter } from "../../core/streaming";

/**
 * Attaches controllers to an Express application.
 * @param app - Express application instance
 * @param controllers - Array of controller classes
 * @param inputCoercion - Input coercion setting
 * @param multipart - Multipart file upload configuration
 */
export async function attachControllers(
  app: Express,
  controllers: Constructor[],
  inputCoercion: InputCoercionSetting = "safe",
  multipart?: boolean | MultipartOptions
): Promise<void> {
  const multipartOptions = normalizeMultipartOptions(multipart);
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
        : createInputCoercer<Record<string, string | number | boolean | undefined>>(
          route.params,
          { mode: inputCoercion, location: "params" }
        );
      const coerceQuery = inputCoercion === false
        ? undefined
        : createInputCoercer<Record<string, unknown>>(route.query, { mode: inputCoercion, location: "query" });

      // Build middleware chain
      const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

      // Add multipart middleware if route has file uploads
      if (multipartOptions && hasFileUploads(route.files)) {
        middlewares.push(createMultipartMiddleware(route.files!, multipartOptions));
      }

      // Main route handler
      const routeHandler = async (req: Request, res: Response, next: NextFunction) => {
        try {
          const files = extractFiles(req);
          const ctx = {
            req,
            res,
            body: req.body,
            query: coerceQuery ? coerceQuery(req.query as Record<string, unknown>) : req.query,
            params: coerceParams ? coerceParams(req.params) : req.params,
            headers: req.headers,
            files,
            sse: route.sse ? createSseEmitter(res) : undefined,
            stream: route.streaming || route.sse ? createStreamWriter(res) : undefined
          } as unknown as RequestContext;
          const result = await handler.call(instance, ctx);
          if (res.headersSent) {
            return;
          }
          if (result === undefined) {
            res.status(defaultStatus(route)).end();
            return;
          }
          res.status(defaultStatus(route)).json(result);
        } catch (error) {
          if (isHttpError(error)) {
            sendHttpError(res, error);
            return;
          }
          next(error);
        }
      };

      middlewares.push(routeHandler);
      app[route.httpMethod](path, ...middlewares);
    }
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

function sendHttpError(res: Response, error: HttpError): void {
  if (res.headersSent) {
    return;
  }
  if (error.headers) {
    for (const [key, value] of Object.entries(error.headers)) {
      res.setHeader(key, value);
    }
  }
  const body = error.body ?? { message: error.message };
  if (body === undefined) {
    res.status(error.status).end();
    return;
  }
  res.status(error.status).json(body);
}

function joinPaths(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
