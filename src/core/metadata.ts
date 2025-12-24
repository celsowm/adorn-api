export const ADORN_CONTROLLER = Symbol.for('adorn.controller');
export const ADORN_ROUTES = Symbol.for('adorn.routes');

export type ControllerMeta = {
  basePath: string;
  tags?: string[];
};

export type IncludePolicy = {
  allowed?: string[];
  maxDepth?: number;
};

export type Guard = (ctx: unknown) => void | Promise<void>;

export type RouteStub = {
  method: string;
  path: string;
  handlerName: string;
  schemas: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
    response?: unknown;
  };
  includePolicy?: IncludePolicy;
  guards?: Guard[];
};

function getOrInitBag(metadata: unknown): Record<PropertyKey, unknown> {
  if (metadata && typeof metadata === 'object') return metadata as Record<PropertyKey, unknown>;
  return Object.create(null) as Record<PropertyKey, unknown>;
}

export function writeControllerMeta(metadata: unknown, meta: ControllerMeta) {
  const bag = getOrInitBag(metadata);
  bag[ADORN_CONTROLLER] = meta;
}

export function pushRouteStub(metadata: unknown, route: RouteStub) {
  const bag = getOrInitBag(metadata);
  const existing = bag[ADORN_ROUTES];
  if (!Array.isArray(existing)) bag[ADORN_ROUTES] = [];
  (bag[ADORN_ROUTES] as RouteStub[]).push(route);
}

export function readControllerMeta(ctor: Function): ControllerMeta | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const md = (ctor as any)[(Symbol as any).metadata] as Record<PropertyKey, unknown> | undefined;
  if (!md) return undefined;
  return md[ADORN_CONTROLLER] as ControllerMeta | undefined;
}

export function readRouteStubs(ctor: Function): RouteStub[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const md = (ctor as any)[(Symbol as any).metadata] as Record<PropertyKey, unknown> | undefined;
  if (!md) return [];
  const v = md[ADORN_ROUTES];
  return Array.isArray(v) ? (v as RouteStub[]) : [];
}
