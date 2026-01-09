import { METADATA_KEYS } from './keys.js';
import type { ControllerMeta, MethodMeta, ResponseMeta } from './types.js';

type MetadataStore = Record<PropertyKey, unknown>;

const getStore = (context: { metadata?: MetadataStore }): MetadataStore => {
  const store = context.metadata ?? {};
  context.metadata = store;
  return store;
};

const mergeTags = (current?: string[], next?: string[]): string[] | undefined => {
  if (!next || next.length === 0) return current;
  if (!current || current.length === 0) return [...next];
  return Array.from(new Set([...current, ...next]));
};

const mergeResponses = (
  current?: ResponseMeta[],
  next?: ResponseMeta[]
): ResponseMeta[] | undefined => {
  if (!next || next.length === 0) return current;
  if (!current || current.length === 0) return [...next];
  return [...current, ...next];
};

const getMethodMap = (store: MetadataStore): Map<PropertyKey, MethodMeta> => {
  let map = store[METADATA_KEYS.methods] as Map<PropertyKey, MethodMeta> | undefined;
  if (!map) {
    map = new Map<PropertyKey, MethodMeta>();
    store[METADATA_KEYS.methods] = map;
  }
  return map;
};

export const mergeControllerMeta = (
  context: { metadata?: MetadataStore },
  patch: ControllerMeta
): void => {
  const store = getStore(context);
  const current = (store[METADATA_KEYS.controller] as ControllerMeta | undefined) ?? {};
  store[METADATA_KEYS.controller] = {
    ...current,
    ...patch,
    tags: mergeTags(current.tags, patch.tags)
  };
};

export const mergeMethodMeta = (
  context: { metadata?: MetadataStore; name?: PropertyKey },
  patch: MethodMeta
): void => {
  const store = getStore(context);
  const map = getMethodMap(store);
  const name = context.name as PropertyKey;
  const current = map.get(name) ?? {};
  map.set(name, {
    ...current,
    ...patch,
    tags: mergeTags(current.tags, patch.tags),
    responses: mergeResponses(current.responses, patch.responses)
  });
};

export const getControllerMetaFromTarget = (target: Function): ControllerMeta => {
  const store = (target as unknown as Record<PropertyKey, unknown>)[Symbol.metadata] as
    | MetadataStore
    | undefined;
  return (store?.[METADATA_KEYS.controller] as ControllerMeta | undefined) ?? {};
};

export const getMethodMetaMapFromTarget = (target: Function): Map<PropertyKey, MethodMeta> => {
  const store = (target as unknown as Record<PropertyKey, unknown>)[Symbol.metadata] as
    | MetadataStore
    | undefined;
  const map = store?.[METADATA_KEYS.methods] as Map<PropertyKey, MethodMeta> | undefined;
  return map ?? new Map<PropertyKey, MethodMeta>();
};
