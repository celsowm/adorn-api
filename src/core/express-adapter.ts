import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { ControllerClass } from '../types/controller.js';
import type { RouteMetadata } from '../types/metadata.js';
import type { HttpContext } from '../decorators/http-params.js';
import { HttpParams } from '../decorators/http-params.js';
import { metadataStorage } from '../metadata/metadata-storage.js';

export class ExpressAdapter {
  constructor(private app: express.Application) {}

  registerController(controllerClass: ControllerClass): void {
    const controllerMetadata = metadataStorage.getController(controllerClass);
    const routes = metadataStorage.getRoutes(controllerClass);

    if (!controllerMetadata) {
      throw new Error(`No metadata found for controller ${controllerClass.name}`);
    }

    const router = express.Router();
    const basePath = controllerMetadata.path;

    routes.forEach((route) => {
      const fullPath = `${basePath}${route.path}`;
      const middlewares = this.buildMiddlewares(
        controllerMetadata.middlewares,
        route.middlewares
      );
      const guards = this.buildGuards(
        controllerMetadata.guards,
        route.guards
      );

      const routeHandler = this.createRouteHandler(
        controllerClass,
        route
      );

      const guardedHandler = this.applyGuards(guards, routeHandler);

      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      router[method](route.path, ...(middlewares as any[]), guardedHandler);

      console.log(`Registered route: ${route.method} ${fullPath}`);
    });

    this.app.use(basePath, router);
  }

  registerControllers(...controllerClasses: ControllerClass[]): void {
    controllerClasses.forEach((controllerClass) =>
      this.registerController(controllerClass)
    );
  }

  private buildMiddlewares(
    controllerMiddlewares: Function[],
    routeMiddlewares: Function[]
  ): Function[] {
    return [...controllerMiddlewares, ...routeMiddlewares];
  }

  private buildGuards(
    controllerGuards: Function[],
    routeGuards: Function[]
  ): Function[] {
    return [...controllerGuards, ...routeGuards];
  }

  private applyGuards(
    guards: Function[],
    handler: express.RequestHandler
  ): express.RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      for (const guard of guards) {
        const result = await guard(req, res, next);
        if (result === false) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
      return handler(req, res, next);
    };
  }

  private createRouteHandler(
    controllerClass: ControllerClass,
    route: RouteMetadata
  ): express.RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const controller = new controllerClass();
        const httpParams = new HttpParams(req, res, next);
        const context: HttpContext = {
          req,
          res,
          next,
          params: httpParams,
        };

        const args = this.resolveParameters(route, req, httpParams, context);

        const result = await controller[route.handlerName](...args);

        if (route.response) {
          res.status(route.response.status);
        }

        res.json(result);
      } catch (error) {
        next(error);
      }
    };
  }

  private resolveParameters(
    route: RouteMetadata,
    _req: Request,
    httpParams: HttpParams,
    context: HttpContext
  ): any[] {
    const args: any[] = [];

    if (route.parameters && route.parameters.length > 0) {
      const sortedParams = [...route.parameters].sort((a, b) => a.index - b.index);

      sortedParams.forEach((param) => {
        switch (param.type) {
          case 'param':
            args.push(httpParams.param(param.name));
            break;
          case 'query':
            args.push(httpParams.query(param.name));
            break;
          case 'body':
            args.push(httpParams.body());
            break;
          case 'header':
            args.push(httpParams.header(param.name));
            break;
          default:
            args.push(undefined);
        }
      });
    } else {
      args.push(context);
    }

    return args;
  }
}
