import type { HttpMethod, RouteMetadata } from '../types/metadata.js';
import { metadataStorage } from '../metadata/metadata-storage.js';
import { enhanceRouteMetadata, type RouteOptions } from './route-options.js';
import { createZodValidationMiddleware } from '../validation/zod-adapter.js';

// Store for routes pending attachment to controller
const pendingRoutes = new Map<Function, RouteMetadata>();

/**
 * Attaches pending routes to a controller when the Controller decorator runs
 */
export function attachPendingRoutesToController(controllerClass: Function): void {
  pendingRoutes.forEach((route, method) => {
    pendingRoutes.delete(method);

    // Collect pending middlewares
    const pendingMiddlewares = metadataStorage.getPendingMiddlewares(method);
    route.middlewares.push(...pendingMiddlewares);
    metadataStorage.clearPendingMiddlewares(method);

    // Collect pending guards
    const pendingGuards = metadataStorage.getPendingGuards(method);
    route.guards.push(...pendingGuards);
    metadataStorage.clearPendingGuards(method);

    // Collect pending parameters
    const pendingParams = metadataStorage.getPendingParameters(method);
    if (pendingParams.length > 0) {
      route.parameters = pendingParams.map((p, index) => ({
        name: p.name,
        type: p.type,
        index,
        schema: p.schema,
        required: p.type === 'params' || p.type === 'body',
      }));
    }
    metadataStorage.clearPendingParameters(method);

    metadataStorage.addRoute(controllerClass, route);
  });
}

/**
 * Extended route options with direct schema support
 */
export interface ExtendedRouteOptions extends RouteOptions { }

/**
 * Creates an HTTP method decorator factory
 */
function createHttpMethodDecorator(method: HttpMethod) {
  return function (
    pathOrOptions?: string | ExtendedRouteOptions,
    options?: ExtendedRouteOptions
  ) {
    return function (
      originalMethod: Function,
      context: ClassMethodDecoratorContext
    ): void {
      if (context.kind !== 'method') return;

      const methodName = String(context.name);

      // Parse arguments
      let path = '';
      let routeOptions: ExtendedRouteOptions | undefined;

      if (typeof pathOrOptions === 'string') {
        path = pathOrOptions;
        routeOptions = options;
      } else if (typeof pathOrOptions === 'object') {
        routeOptions = pathOrOptions;
      }

      // Build base route
      const baseRoute: RouteMetadata = {
        path,
        method,
        handlerName: methodName,
        middlewares: [],
        guards: [],
        parameters: [],
      };

      // Apply options enhancement
      const route = enhanceRouteMetadata(baseRoute, routeOptions);

      // Process inline schemas if provided in options
      if (routeOptions) {
        processInlineSchemas(originalMethod, routeOptions);
      }

      // Store route for later attachment to controller
      pendingRoutes.set(originalMethod, route);
    };
  };
}

/**
 * Process inline schema definitions in route options
 */
function processInlineSchemas(
  method: Function,
  options: ExtendedRouteOptions
): void {
  // Handle params schema
  if (options.params) {
    metadataStorage.addPendingMiddleware(
      method,
      createZodValidationMiddleware('params', options.params)
    );
    metadataStorage.addPendingParameter(method, {
      name: 'params',
      type: 'params',
      schema: options.params,
    });
  }

  // Handle body schema
  if (options.body) {
    metadataStorage.addPendingMiddleware(
      method,
      createZodValidationMiddleware('body', options.body)
    );
    metadataStorage.addPendingParameter(method, {
      name: 'body',
      type: 'body',
      schema: options.body,
    });
  }

  // Handle query schema
  if (options.query) {
    metadataStorage.addPendingMiddleware(
      method,
      createZodValidationMiddleware('query', options.query)
    );
    metadataStorage.addPendingParameter(method, {
      name: 'query',
      type: 'query',
      schema: options.query,
    });
  }
}

// Export HTTP method decorators
export const Get = createHttpMethodDecorator('GET');
export const Post = createHttpMethodDecorator('POST');
export const Put = createHttpMethodDecorator('PUT');
export const Patch = createHttpMethodDecorator('PATCH');
export const Delete = createHttpMethodDecorator('DELETE');
