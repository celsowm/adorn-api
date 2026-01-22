import type { Express, Request, Response, NextFunction } from "express";
import type { Constructor } from "../../core/types";
import { getControllerMeta } from "../../core/metadata";
import { isHttpError, type HttpError } from "../../core/errors";
import type { InputCoercionSetting, RequestContext } from "./types";
import { createInputCoercer } from "./coercion";

/**
 * Attaches controllers to an Express application.
 * @param app - Express application instance
 * @param controllers - Array of controller classes
 * @param inputCoercion - Input coercion setting
 */
export function attachControllers(
  app: Express,
  controllers: Constructor[],
  inputCoercion: InputCoercionSetting = "safe"
): void {
  for (const controller of controllers) {
    const meta = getControllerMeta(controller);
    if (!meta) {
      throw new Error(`Controller "${controller.name}" is missing @Controller decorator.`);
    }
    const instance = new controller();
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
      app[route.httpMethod](path, async (req: Request, res: Response, next: NextFunction) => {
        try {
          const ctx: RequestContext = {
            req,
            res,
            body: req.body,
            query: coerceQuery ? coerceQuery(req.query as Record<string, unknown>) : req.query,
            params: coerceParams ? coerceParams(req.params) : req.params,
            headers: req.headers
          };
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
      });
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
