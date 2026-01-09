import type { RouteDefinition, RouteRegistry } from '../core/metadata/types.js';
import type { HttpContext } from './context.js';
import { bindArgs, type ArgBinding } from './bindings.js';

export type RouteHandler = (ctx: HttpContext) => Promise<unknown> | unknown;

export interface RouterAdapter {
  addRoute(route: RouteDefinition, handler: RouteHandler): void;
}

export interface RouterOptions {
  bindings?: Map<PropertyKey, ArgBinding[]>;
  createController?: (controller: Function) => unknown;
}

const defaultCreateController = (controller: Function): unknown =>
  new (controller as new () => unknown)();

export const buildRouter = (
  registry: RouteRegistry,
  adapter: RouterAdapter,
  options: RouterOptions = {}
): void => {
  const createController = options.createController ?? defaultCreateController;

  for (const route of registry.routes) {
    adapter.addRoute(route, async (ctx: HttpContext) => {
      const instance = createController(route.controller) as Record<PropertyKey, unknown>;
      const handler = instance[route.handler] as (...args: unknown[]) => unknown;
      const bindings = options.bindings?.get(route.handler) ?? [];
      ctx.route = route;
      ctx.contract = route.contract;
      const args = bindings.length ? bindArgs(ctx, bindings) : [ctx];
      return handler.apply(instance, args);
    });
  }
};
