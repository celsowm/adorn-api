import type { RequestContext } from '../../contracts/context';
import type { RouteEntry } from '../registry/types';
import { getPathTokenNames } from './rules/inferFromPath';
import { conventionForMethod } from './rules/inferFromHttpMethod';
import type { CoerceMode } from './coerce/primitives';
import { coerceObjectSmart, coerceValueSmart } from './coerce/arrays';

export type BindOptions = {
  coerce?: CoerceMode;
  csv?: boolean;
  passContext?: boolean;
};

export function bindArgs(
  route: RouteEntry,
  handler: Function,
  ctx: RequestContext,
  opts: BindOptions = {},
): unknown[] {
  const passContext = opts.passContext ?? true;
  const coerceMode: CoerceMode = opts.coerce ?? 'smart';
  const csv = opts.csv ?? true;

  const tokenNames = getPathTokenNames(route.fullPath);

  const pathArgs = tokenNames.map((t) => {
    const raw = ctx.params?.[t];
    return raw === undefined ? undefined : raw;
  });

  const conv = conventionForMethod(route.method);

  const expected = typeof handler.length === 'number' ? handler.length : pathArgs.length;

  const args: unknown[] = [...pathArgs];

  const remainingSlots = Math.max(0, expected - args.length);

  const normalizedQuery = coerceMode === 'smart'
    ? coerceObjectSmart(normalizeQuery(ctx.query), { csv })
    : normalizeQuery(ctx.query);

  const normalizedBody = coerceMode === 'smart'
    ? coerceValueSmart(ctx.body, { csv })
    : ctx.body;

  if (remainingSlots > 0) {
    const payloads: unknown[] = [];

    if (conv.primary === 'query') payloads.push(normalizedQuery);
    else if (conv.primary === 'body') payloads.push(normalizedBody);

    if (conv.secondary === 'query') payloads.push(normalizedQuery);
    else if (conv.secondary === 'body') payloads.push(normalizedBody);

    for (let i = 0; i < Math.min(remainingSlots, payloads.length); i++) {
      args.push(payloads[i]);
    }
  }

  if (passContext && args.length < expected) {
    args.push(ctx);
  }

  return args;
}

function normalizeQuery(q: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!q || typeof q !== 'object') return {};
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(q)) {
    out[k] = v;
  }

  return out;
}
