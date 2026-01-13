import type { MiddlewareFunction } from '../types/controller.js';
import { metadataStorage } from '../metadata/metadata-storage.js';

export function Use(...middlewares: MiddlewareFunction[]) {
  return function (
    target: Function | Function,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ): Function | void {
    if (context.kind === 'class') {
      const controllerMeta = metadataStorage.getController(target as Function);
      if (controllerMeta) {
        controllerMeta.middlewares.push(...middlewares);
      }
    } else if (context.kind === 'method') {
      const methodName = String(context.name);
      const controllerClass = context.constructor;
      const routes = metadataStorage.getRoutes(controllerClass);

      const route = routes.find((r) => r.handlerName === methodName);

      if (route) {
        route.middlewares.push(...middlewares);
      }
    }

    return target as Function;
  };
}

export function Guard(...guards: Function[]) {
  return function (
    target: Function | Function,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ): Function | void {
    if (context.kind === 'class') {
      const controllerMeta = metadataStorage.getController(target as Function);
      if (controllerMeta) {
        controllerMeta.guards.push(...guards);
      }
    } else if (context.kind === 'method') {
      const methodName = String(context.name);
      const controllerClass = context.constructor;
      const routes = metadataStorage.getRoutes(controllerClass);

      const route = routes.find((r) => r.handlerName === methodName);

      if (route) {
        route.guards.push(...guards);
      }
    }

    return target as Function;
  };
}
