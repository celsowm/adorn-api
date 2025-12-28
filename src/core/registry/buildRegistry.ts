import { META, type BindingsMeta, type ControllerMeta, type RouteMeta } from '../../metadata/keys';
import { bagFromClass, bagGet } from '../../metadata/bag';
import { mergeBags } from '../../metadata/merge';
import { joinPaths } from './normalize';
import { assertNoRouteConflicts } from './conflicts';
import type { ControllerCtor, ControllerEntry, Registry, RouteEntry } from './types';

function mergedBagFromClass(ctor: Function) {
  const chain: Function[] = [];
  let cur: any = ctor;

  while (typeof cur === 'function' && cur !== Function.prototype) {
    chain.push(cur);
    cur = Object.getPrototypeOf(cur);
    if (!cur || cur === Function || cur === Function.prototype) break;
  }

  chain.reverse();

  let merged = {} as Record<PropertyKey, unknown>;
  for (const c of chain) {
    merged = mergeBags(merged, bagFromClass(c));
  }
  return merged;
}

function requireControllerMeta(ctor: Function, bag: Record<PropertyKey, unknown>): ControllerMeta {
  const meta = bagGet<ControllerMeta>(bag as any, META.controller);
  if (!meta?.basePath && meta?.basePath !== '') {
    throw new Error(
      `Missing @Controller(...) on ${ctor.name || '(anonymous class)'} (no controller metadata found).`,
    );
  }
  return meta;
}

export function buildRegistry(controllers: ControllerCtor[]): Registry {
  const controllerEntries: ControllerEntry[] = [];
  const routes: RouteEntry[] = [];

  for (const ctor of controllers) {
    const mergedBag = mergedBagFromClass(ctor);

    const controllerMeta = requireControllerMeta(ctor, mergedBag);
    controllerEntries.push({ ctor, meta: controllerMeta });

    const routeMetas = (mergedBag[META.routes] ?? []) as RouteMeta[];
    if (!Array.isArray(routeMetas)) {
      throw new Error(
        `Invalid route metadata on ${ctor.name}: expected an array at META.routes.`,
      );
    }
    const bindingsMeta = mergedBag[META.bindings] as BindingsMeta | undefined;

    for (const rm of routeMetas) {
      const fullPath = joinPaths(controllerMeta.basePath, rm.path);

      const methodBindings = bindingsMeta?.byMethod?.[rm.name];
      routes.push({
        method: rm.method,
        fullPath,
        routePath: rm.path,
        handlerName: rm.name,
        controller: ctor,
        options: rm.options,
        bindings: methodBindings ? { byMethod: { [rm.name]: methodBindings } } : undefined,
      });
    }
  }

  assertNoRouteConflicts(routes);

  return {
    controllers: controllerEntries,
    routes,
  };
}
