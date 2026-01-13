import type { HttpMethod, RouteMetadata } from '../types/metadata.js';
import { metadataStorage } from '../metadata/metadata-storage.js';
import type { RouteOptions } from './route-options.js';
import { enhanceRouteMetadata } from './route-options.js';

const pendingRoutes = new Map<Function, RouteMetadata>();

export function attachPendingRoutesToController(controllerClass: Function): void {
  pendingRoutes.forEach((route, method) => {
    pendingRoutes.delete(method);
    metadataStorage.addRoute(controllerClass, route);
  });
}

function createHttpMethodDecorator(method: HttpMethod) {
  return function (
    pathOrOptions?: string | RouteOptions,
    options?: RouteOptions
  ) {
    return function (
      originalMethod: Function,
      context: ClassMethodDecoratorContext
    ): void {
      if (context.kind === 'method') {
        const methodName = String(context.name);

        let path = '';
        let routeOptions: RouteOptions | undefined;

        if (typeof pathOrOptions === 'string') {
          path = pathOrOptions;
          routeOptions = options;
        } else if (typeof pathOrOptions === 'object') {
          routeOptions = pathOrOptions;
        }

        const baseRoute: RouteMetadata = {
          path,
          method,
          handlerName: methodName,
          middlewares: [],
          guards: [],
          parameters: [],
        };

        const route = enhanceRouteMetadata(baseRoute, routeOptions);

        pendingRoutes.set(originalMethod, route);
      }
    };
  };
}

export const Get = createHttpMethodDecorator('GET');
export const Post = createHttpMethodDecorator('POST');
export const Put = createHttpMethodDecorator('PUT');
export const Patch = createHttpMethodDecorator('PATCH');
export const Delete = createHttpMethodDecorator('DELETE');
