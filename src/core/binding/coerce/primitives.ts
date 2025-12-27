export type CoerceMode = 'none' | 'smart';

export function coercePrimitiveSmart(v: unknown): unknown {
  if (typeof v !== 'string') return v;

  const s = v.trim();

  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;

  if (s !== '' && /^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }

  return v;
}
