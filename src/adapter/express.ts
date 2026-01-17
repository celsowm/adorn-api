import express, { type Request, type Response, type NextFunction } from "express";
import type { Constructor } from "../core/types";
import { getControllerMeta } from "../core/metadata";

export interface RequestContext<TBody = unknown, TQuery = unknown, TParams = unknown, THeaders = unknown> {
  req: Request;
  res: Response;
  body: TBody;
  query: TQuery;
  params: TParams;
  headers: THeaders;
}

export interface ExpressAdapterOptions {
  controllers: Constructor[];
  jsonBody?: boolean;
}

export function createExpressApp(options: ExpressAdapterOptions): express.Express {
  const app = express();
  if (options.jsonBody ?? true) {
    app.use(express.json());
  }
  attachControllers(app, options.controllers);
  return app;
}

export function attachControllers(app: express.Express, controllers: Constructor[]): void {
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
      app[route.httpMethod](path, async (req: Request, res: Response, next: NextFunction) => {
        try {
          const ctx: RequestContext = {
            req,
            res,
            body: req.body,
            query: req.query,
            params: req.params,
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
          next(error);
        }
      });
    }
  }
}

function defaultStatus(route: { responses?: Array<{ status: number }> }): number {
  return route.responses?.[0]?.status ?? 200;
}

function joinPaths(basePath: string, routePath: string): string {
  const base = basePath ? basePath.replace(/\/+$/, "") : "";
  const route = routePath ? routePath.replace(/^\/+/, "") : "";
  if (!base && !route) {
    return "/";
  }
  if (!base) {
    return `/${route}`;
  }
  if (!route) {
    return base.startsWith("/") ? base : `/${base}`;
  }
  return `${base.startsWith("/") ? base : `/${base}`}/${route}`;
}
