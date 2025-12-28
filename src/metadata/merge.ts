import type { MetaBag } from './bag.js';

/**
 * Minimal merge strategy for inheritance.
 * - objects: shallow merge (child overrides)
 * - arrays: concat (base first)
 * - primitives: child overrides
 */
export function mergeBags(base: MetaBag, child: MetaBag): MetaBag {
  const out: MetaBag = { ...base };

  for (const key of Reflect.ownKeys(child)) {
    const baseValue = out[key];
    const childValue = child[key];

    if (Array.isArray(baseValue) && Array.isArray(childValue)) {
      out[key] = [...baseValue, ...childValue];
      continue;
    }

    if (isPlainObject(baseValue) && isPlainObject(childValue)) {
      out[key] = { ...(baseValue as object), ...(childValue as object) } as any;
      continue;
    }

    out[key] = childValue;
  }

  return out;
}

function isPlainObject(value: unknown): value is object {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
