import type { ResponseMetadata } from '../types/metadata.js';
import { metadataStorage } from '../metadata/metadata-storage.js';

export function Response(status: number = 200, description?: string, schema?: any) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: 'method' }
  ): Function | void {
    if (context.kind === 'method') {
      const methodName = String(context.name);
      const controllerClass = context.constructor;
      const routes = metadataStorage.getRoutes(controllerClass);

      const route = routes.find((r) => r.handlerName === methodName);

      if (route) {
        const response: ResponseMetadata = {
          status,
          description,
          schema,
        };
        route.response = response;
      }

      return originalMethod;
    }
  };
}

export function Header(name: string, value: string) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: 'method' }
  ): Function | void {
    if (context.kind === 'method') {
      const methodName = String(context.name);
      const controllerClass = context.constructor;
      const routes = metadataStorage.getRoutes(controllerClass);

      const route = routes.find((r) => r.handlerName === methodName);

      if (route) {
        if (!route.middlewares) {
          route.middlewares = [];
        }

        route.middlewares.push((_req: any, res: any, next: any) => {
          res.setHeader(name, value);
          next();
        });
      }

      return originalMethod;
    }
  };
}
