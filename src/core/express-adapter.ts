import {
  type Application,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
  Router,
} from "express";
import type { ControllerClass } from "../types/controller.js";
import type { RouteMetadata, ParameterMetadata } from "../types/metadata.js";
import { metadataStorage } from "../metadata/metadata-storage.js";
import { HttpParams, type HttpContext } from "../decorators/http-params.js";
import { isHttpError, HttpError } from "./http-error.js";

export { HttpError, isHttpError };

export class ExpressAdapter {
  constructor(private app: Application) {}

  /**
   * Register error handling middleware
   */
  registerErrorMiddleware(): void {
    this.app.use(
      (err: any, _req: Request, res: Response, _next: NextFunction) => {
        if (isHttpError(err)) {
          res.status(err.status).json(err.payload);
          return;
        }

        console.error("Unhandled error:", err);
        const status = err.status || err.statusCode || 500;
        res.status(status).json({
          error: err.message ?? "Internal Server Error",
        });
      },
    );
  }

  /**
   * Register a single controller
   */
  registerController(controllerClass: ControllerClass): void {
    const controllerMetadata = metadataStorage.getController(controllerClass);
    const routes = metadataStorage.getRoutes(controllerClass);

    if (!controllerMetadata) {
      throw new Error(
        `No metadata found for controller ${controllerClass.name}. ` +
          `Make sure it's decorated with @Controller()`,
      );
    }

    const router = Router();
    const basePath = controllerMetadata.path;

    routes.forEach((route) => {
      const middlewares = this.buildMiddlewares(
        controllerMetadata.middlewares,
        route.middlewares,
      );

      const guards = this.buildGuards(controllerMetadata.guards, route.guards);

      const routeHandler = this.createRouteHandler(controllerClass, route);
      const guardedHandler = this.applyGuards(guards, routeHandler);

      const method = route.method.toLowerCase() as
        | "get"
        | "post"
        | "put"
        | "patch"
        | "delete";

      router[method](
        route.path,
        ...(middlewares as RequestHandler[]),
        guardedHandler,
      );
    });

    this.app.use(basePath, router);
  }

  /**
   * Register multiple controllers
   */
  registerControllers(...controllerClasses: ControllerClass[]): void {
    controllerClasses.forEach((c) => this.registerController(c));
  }

  private buildMiddlewares(
    controllerMiddlewares: Function[],
    routeMiddlewares: Function[],
  ): Function[] {
    return [...controllerMiddlewares, ...routeMiddlewares];
  }

  private buildGuards(
    controllerGuards: Function[],
    routeGuards: Function[],
  ): Function[] {
    return [...controllerGuards, ...routeGuards];
  }

  private applyGuards(
    guards: Function[],
    handler: RequestHandler,
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      for (const guard of guards) {
        const result = await guard(req, res, next);
        if (result === false) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
      }
      return handler(req, res, next);
    };
  }

  private createRouteHandler(
    controllerClass: ControllerClass,
    route: RouteMetadata,
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const controller = new (controllerClass as any)();
        const httpParams = new HttpParams(req, res, next);

        const context: HttpContext = {
          req,
          res,
          next,
          params: httpParams,
        };

        const args = this.resolveParameters(route, req, httpParams, context);
        const result = await (controller as any)[route.handlerName](...args);

        // Handle response status from {status, ...body} convention
        let statusCode = route.response?.status ?? 200;
        let body = result;

        if (
          result &&
          typeof result === "object" &&
          "status" in result &&
          typeof (result as any).status === "number"
        ) {
          statusCode = (result as any).status;
          const { status, ...rest } = result as any;
          body = rest;
        }

        // Don't send response if already sent (streaming, etc.)
        if (!res.headersSent) {
          if (body === undefined || body === null) {
            res.status(204).end();
          } else {
            res.status(statusCode).json(body);
          }
        }
      } catch (error) {
        next(error);
      }
    };
  }

  private resolveParameters(
    route: RouteMetadata,
    req: Request,
    httpParams: HttpParams,
    context: HttpContext,
  ): any[] {
    const args: any[] = [];

    // If we have defined parameters, use them
    if (route.parameters && route.parameters.length > 0) {
      const sortedParams = [...route.parameters].sort(
        (a, b) => a.index - b.index,
      );

      sortedParams.forEach((param) => {
        args.push(this.resolveParameter(param, req, httpParams, context));
      });
    } else {
      // Fallback: provide context as single argument
      args.push(context);
    }

    return args;
  }

  private resolveParameter(
    param: ParameterMetadata,
    req: Request,
    _httpParams: HttpParams,
    _context: HttpContext,
  ): any {
    switch (param.type) {
      case "params":
        return req.params;

      case "query":
        return (req as any).query;

      case "body":
        return req.body;

      case "combined":
        return {
          params: req.params,
          body: req.body,
          query: (req as any).query,
        };

      default:
        return undefined;
    }
  }
}
