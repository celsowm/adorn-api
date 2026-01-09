import { getControllerMetaFromTarget, getMethodMetaMapFromTarget } from './collector.js';
import type { ControllerDefinition, RouteDefinition, RouteRegistry } from './types.js';

const controllerRegistry = new Set<Function>();

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '');

const joinPaths = (basePath: string | undefined, routePath: string | undefined): string => {
  const parts = [basePath ?? '', routePath ?? '']
    .map(trimSlashes)
    .filter(part => part.length > 0);
  if (parts.length === 0) return '/';
  return `/${parts.join('/')}`;
};

export const registerController = (controller: Function): void => {
  controllerRegistry.add(controller);
};

export const getRegisteredControllers = (): Function[] => Array.from(controllerRegistry);

export const buildRegistry = (controllers: Function[] = getRegisteredControllers()): RouteRegistry => {
  const controllerDefs: ControllerDefinition[] = [];
  const routes: RouteDefinition[] = [];

  for (const controller of controllers) {
    const meta = getControllerMetaFromTarget(controller);
    const methods = getMethodMetaMapFromTarget(controller);
    const controllerRoutes: RouteDefinition[] = [];

    methods.forEach((methodMeta, handler) => {
      if (!methodMeta.method || methodMeta.path === undefined) {
        return;
      }

      const method = methodMeta.method;
      const path = methodMeta.path;
      const fullPath = joinPaths(meta.basePath, methodMeta.path);
      const route: RouteDefinition = {
        ...methodMeta,
        method,
        path,
        controller,
        handler,
        fullPath
      };
      controllerRoutes.push(route);
      routes.push(route);
    });

    controllerDefs.push({
      controller,
      meta,
      methods,
      routes: controllerRoutes
    });
  }

  return { controllers: controllerDefs, routes };
};
