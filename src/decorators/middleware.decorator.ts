import type { MiddlewareFunction } from '../types/controller.js';
import { metadataStorage } from '../metadata/metadata-storage.js';

export function Use(...middlewares: MiddlewareFunction[]) {
  return function (
    target: Function | Function,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ): void {
    if (context.kind === 'class') {
      const controllerMeta = metadataStorage.getController(target as Function);
      if (controllerMeta) {
        controllerMeta.middlewares.push(...middlewares);
      }
    } else if (context.kind === 'method') {
      const methodFunction = target as Function;
      middlewares.forEach((mw) => {
        metadataStorage.addPendingMiddleware(methodFunction, mw);
      });
    }


  };
}

export function Guard(...guards: Function[]) {
  return function (
    target: Function | Function,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ): void {
    if (context.kind === 'class') {
      const controllerMeta = metadataStorage.getController(target as Function);
      if (controllerMeta) {
        controllerMeta.guards.push(...guards);
      }
    } else if (context.kind === 'method') {
      const methodFunction = target as Function;
      guards.forEach((g) => {
        metadataStorage.addPendingGuard(methodFunction, g);
      });
    }


  };
}
