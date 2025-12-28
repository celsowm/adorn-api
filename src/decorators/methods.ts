import { META, type RouteMeta } from '../metadata/keys';
import { bagFromContext, bagPush } from '../metadata/bag';
import type { RouteOptions } from '../contracts/route-options';

type Stage3MethodContext = ClassMethodDecoratorContext;

/**
 * Internal helper: store route metadata for a method.
 */
function addRoute(context: Stage3MethodContext, route: Omit<RouteMeta, 'name'>) {
  const bag = bagFromContext(context);
  const name = String(context.name);

  const meta: RouteMeta = {
    ...route,
    name,
  };

  bagPush<RouteMeta>(bag, META.routes, meta);
}

function normalizeRoutePath(p: string): string {
  if (!p) return '';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  if (out !== '/' && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

export function Get<Path extends string>(path: Path, options?: RouteOptions<Path>) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'GET', path: normalizeRoutePath(path), options });
  };
}

export function Post<Path extends string>(path: Path, options?: RouteOptions<Path>) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'POST', path: normalizeRoutePath(path), options });
  };
}

export function Put<Path extends string>(path: Path, options?: RouteOptions<Path>) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'PUT', path: normalizeRoutePath(path), options });
  };
}

export function Patch<Path extends string>(path: Path, options?: RouteOptions<Path>) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'PATCH', path: normalizeRoutePath(path), options });
  };
}

export function Delete<Path extends string>(path: Path, options?: RouteOptions<Path>) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'DELETE', path: normalizeRoutePath(path), options });
  };
}
