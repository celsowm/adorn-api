import {
  META,
  type BindingsMeta,
  type ControllerMeta,
  type DocsMeta,
  type RouteMeta,
  type SecurityMeta,
} from '../../metadata/keys.js';
import { bagFromClass, bagGet, type MetaConstructor } from '../../metadata/bag.js';
import { mergeBags } from '../../metadata/merge.js';
import { joinPaths } from './normalize.js';
import { assertNoRouteConflicts } from './conflicts.js';
import type { ControllerCtor, ControllerEntry, Registry, RouteEntry } from './types.js';
import type { RouteBindings, RouteOptions, RouteValidate } from '../../contracts/route-options.js';
import type { SecurityRequirementObject } from '../../contracts/openapi-v3.js';

function mergedBagFromClass(ctor: MetaConstructor) {
  const chain: MetaConstructor[] = [];
  let cur: MetaConstructor | null = ctor;

  while (cur && typeof cur === 'function') {
    chain.push(cur);
    const parent = Object.getPrototypeOf(cur) as MetaConstructor | null;
    if (!parent || parent === Function || parent === Function.prototype) break;
    cur = parent;
  }

  chain.reverse();

  let merged = {} as Record<PropertyKey, unknown>;
  for (const c of chain) {
    merged = mergeBags(merged, bagFromClass(c));
  }
  return merged;
}

function requireControllerMeta(ctor: MetaConstructor, bag: Record<PropertyKey, unknown>): ControllerMeta {
  const meta = bagGet<ControllerMeta>(bag, META.controller);
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
  const securitySchemes: NonNullable<Registry['securitySchemes']> = {};

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
    const docsMeta = bagGet<DocsMeta>(mergedBag, META.docs);
    const securityMeta = bagGet<SecurityMeta>(mergedBag, META.security);
    if (securityMeta?.schemes) {
      Object.assign(securitySchemes, securityMeta.schemes);
    }

    for (const rm of routeMetas) {
      const fullPath = joinPaths(controllerMeta.basePath, rm.path);
      const baseDocs = docsMeta ? baseDocsToRouteOptions(docsMeta) : undefined;
      const methodDocs = docsMeta?.byMethod?.[rm.name] as RouteOptions<string> | undefined;
      const mergedOptions = mergeRouteOptions(
        rm.options as RouteOptions<string> | undefined,
        baseDocs,
        methodDocs,
      );

      const methodBindings = bindingsMeta?.byMethod?.[rm.name];
      routes.push({
        method: rm.method,
        fullPath,
        routePath: rm.path,
        handlerName: rm.name,
        controller: ctor,
        ...(mergedOptions ? { options: mergedOptions } : { options: rm.options }),
        ...(methodBindings ? { bindings: { byMethod: { [rm.name]: methodBindings } } } : {}),
      });
    }
  }

  assertNoRouteConflicts(routes);

  return {
    controllers: controllerEntries,
    routes,
    ...(Object.keys(securitySchemes).length ? { securitySchemes } : {}),
  };
}

type RouteOptionsAny = RouteOptions<string>;

function baseDocsToRouteOptions(docs: DocsMeta): Partial<RouteOptionsAny> | undefined {
  const out: Partial<RouteOptionsAny> = {};

  if (docs.tags?.length) out.tags = [...docs.tags];
  if (docs.security !== undefined) out.security = docs.security as SecurityRequirementObject[];
  if (docs.operationId !== undefined) out.operationId = docs.operationId;
  if (docs.deprecated !== undefined) out.deprecated = docs.deprecated;
  if (docs.responses) {
    out.responses = {
      ...(out.responses ?? {}),
      ...docs.responses,
    };
  }

  return Object.keys(out).length ? out : undefined;
}

function mergeRouteOptions(
  base: RouteOptionsAny | undefined,
  ...overlays: Array<Partial<RouteOptionsAny> | undefined>
): RouteOptionsAny | undefined {
  if (!base && overlays.every((o) => !o)) return base;

  const out: RouteOptionsAny = { ...(base ?? {}) };

  for (const overlay of overlays) {
    if (!overlay) continue;

    if (overlay.tags?.length) {
      out.tags = [...(out.tags ?? []), ...overlay.tags];
    }

    if (overlay.summary !== undefined) out.summary = overlay.summary;
    if (overlay.description !== undefined) out.description = overlay.description;
    if (overlay.operationId !== undefined) out.operationId = overlay.operationId;
    if (overlay.deprecated !== undefined) out.deprecated = overlay.deprecated;
    if (overlay.security !== undefined) out.security = overlay.security;
    if (overlay.successStatus !== undefined) out.successStatus = overlay.successStatus;

    if (overlay.responses) {
      out.responses = {
        ...(out.responses ?? {}),
        ...overlay.responses,
      };
    }

    const mergedValidate = mergeValidate(out.validate, overlay.validate);
    if (mergedValidate) {
      out.validate = mergedValidate;
    }

    const mergedBindings = mergeBindings(out.bindings, overlay.bindings);
    if (mergedBindings) {
      out.bindings = mergedBindings;
    }
  }

  return out;
}

function mergeValidate(
  base?: RouteValidate,
  overlay?: RouteValidate,
): RouteValidate | undefined {
  if (!base && !overlay) return undefined;

  const merged: RouteValidate = {};

  if (base?.params) merged.params = base.params;
  if (base?.query) merged.query = base.query;
  if (base?.body) merged.body = base.body;

  if (overlay?.params) merged.params = overlay.params;
  if (overlay?.query) merged.query = overlay.query;
  if (overlay?.body) merged.body = overlay.body;

  return Object.keys(merged).length ? merged : undefined;
}

function mergeBindings(
  base?: RouteBindings<string>,
  overlay?: RouteBindings<string>,
): RouteBindings<string> | undefined {
  if (!base && !overlay) return undefined;

  const merged: RouteBindings<string> = {};

  if (base?.path) merged.path = { ...base.path };
  if (overlay?.path) {
    merged.path = {
      ...(merged.path ?? {}),
      ...overlay.path,
    };
  }

  return Object.keys(merged).length ? merged : undefined;
}
