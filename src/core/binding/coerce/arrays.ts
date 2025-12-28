import { coercePrimitiveSmart } from './primitives.js';
import { splitCsv } from './csv.js';

export type ArrayCoerceOptions = {
  csv?: boolean;
};

export function coerceArraySmart(arr: unknown[], opts: ArrayCoerceOptions): unknown[] {
  const out: unknown[] = [];

  for (const item of arr) {
    if (typeof item === 'string' && opts.csv && item.includes(',')) {
      for (const part of splitCsv(item)) out.push(coercePrimitiveSmart(part));
      continue;
    }
    out.push(coerceValueSmart(item, opts));
  }

  return out;
}

export function coerceValueSmart(v: unknown, opts: ArrayCoerceOptions): unknown {
  if (Array.isArray(v)) return coerceArraySmart(v, opts);
  if (v && typeof v === 'object') return coerceObjectSmart(v as Record<string, unknown>, opts);
  return coercePrimitiveSmart(v);
}

export function coerceObjectSmart(obj: Record<string, unknown>, opts: ArrayCoerceOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = coerceValueSmart(v, opts);
  return out;
}
