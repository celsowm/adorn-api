import { META, type RouteMeta } from '../metadata/keys';
import { bagFromContext, bagPush } from '../metadata/bag';

export type RouteOptions = {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  [k: string]: unknown;
};

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

export function Get(path: string, options?: RouteOptions) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'GET', path: normalizeRoutePath(path), options });
  };
}

export function Post(path: string, options?: RouteOptions) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'POST', path: normalizeRoutePath(path), options });
  };
}

export function Put(path: string, options?: RouteOptions) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'PUT', path: normalizeRoutePath(path), options });
  };
}

export function Patch(path: string, options?: RouteOptions) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'PATCH', path: normalizeRoutePath(path), options });
  };
}

export function Delete(path: string, options?: RouteOptions) {
  return function (_value: Function, context: Stage3MethodContext) {
    addRoute(context, { method: 'DELETE', path: normalizeRoutePath(path), options });
  };
}
