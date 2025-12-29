import { SYMBOL_METADATA } from './keys.js';

/**
 * In TS Stage-3, decorator contexts expose `context.metadata`.
 * At runtime, class metadata can be read at `Ctor[Symbol.metadata]`.
 *
 * We treat the metadata as an open bag: Record<PropertyKey, unknown>.
 */
export type MetaBag = Record<PropertyKey, unknown>;

export type MetaConstructor = new (...args: never[]) => unknown;

export function bagFromContext(context: { metadata?: object | undefined }): MetaBag {
  const target = context as { metadata?: object };
  if (!target.metadata) {
    target.metadata = {};
  }
  return target.metadata as unknown as MetaBag;
}

type ConstructorWithMetadata = MetaConstructor & {
  [SYMBOL_METADATA]?: MetaBag;
};

export function bagFromClass(ctor: MetaConstructor): MetaBag {
  const ctorWithMeta = ctor as ConstructorWithMetadata;
  return (ctorWithMeta[SYMBOL_METADATA] ?? {}) as MetaBag;
}

export function bagGet<T>(bag: MetaBag, key: PropertyKey): T | undefined {
  return bag[key] as T | undefined;
}

export function bagSet<T>(bag: MetaBag, key: PropertyKey, value: T): void {
  bag[key] = value as unknown;
}

export function bagEnsureObject<T extends object>(bag: MetaBag, key: PropertyKey, init: () => T): T {
  const existing = bag[key];
  if (existing && typeof existing === 'object') return existing as T;
  const created = init();
  bag[key] = created as unknown;
  return created;
}

export function bagEnsureArray<T>(bag: MetaBag, key: PropertyKey): T[] {
  const existing = bag[key];
  if (Array.isArray(existing)) return existing as T[];
  const created: T[] = [];
  bag[key] = created as unknown;
  return created;
}

export function bagPush<T>(bag: MetaBag, key: PropertyKey, item: T): void {
  const arr = bagEnsureArray<T>(bag, key);
  arr.push(item);
}
