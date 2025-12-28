import type { RequestContext } from '../../contracts/context';
import type { RouteEntry } from '../registry/types';
import { HttpError } from '../errors/http-error';
import { getPathTokenNames } from './rules/inferFromPath';
import { conventionForMethod } from './rules/inferFromHttpMethod';
import type { CoerceMode } from './coerce/primitives';
import { coerceObjectSmart, coerceValueSmart } from './coerce/arrays';

export type BindingPrepared = {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
};

export type BindArgsResult = {
  args: unknown[];
  prepared: BindingPrepared;
};

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
): BindArgsResult {
  const passContext = opts.passContext ?? true;
  const coerceMode: CoerceMode = opts.coerce ?? 'smart';
  const csv = opts.csv ?? true;

  const tokenNames = getPathTokenNames(route.fullPath);
  const methodBindings = route.bindings?.byMethod?.[route.handlerName];
  const pathTypes = methodBindings?.path ?? {};

  const rawParams = ctx.params ?? {};
  const preparedParams: Record<string, unknown> = {};

  const pathArgs = tokenNames.map((t) => {
    const raw = rawParams[t];
    const hint = pathTypes[t];
    const value = coercePathValue(raw, hint, t);
    preparedParams[t] = value;
    return value;
  });

  for (const [key, value] of Object.entries(rawParams)) {
    if (!(key in preparedParams)) {
      preparedParams[key] = value;
    }
  }

  const conv = conventionForMethod(route.method);

  const expected = typeof handler.length === 'number' ? handler.length : pathArgs.length;

  const args: unknown[] = [...pathArgs];

  const remainingSlots = Math.max(0, expected - args.length);

  const preparedQuery = coerceMode === 'smart'
    ? coerceObjectSmart(normalizeQuery(ctx.query), { csv })
    : normalizeQuery(ctx.query);

  const preparedBody = coerceMode === 'smart'
    ? coerceValueSmart(ctx.body, { csv })
    : ctx.body;

  if (remainingSlots > 0) {
    const payloads: unknown[] = [];

      if (conv.primary === 'query') payloads.push(preparedQuery);
      else if (conv.primary === 'body') payloads.push(preparedBody);

      if (conv.secondary === 'query') payloads.push(preparedQuery);
      else if (conv.secondary === 'body') payloads.push(preparedBody);

    for (let i = 0; i < Math.min(remainingSlots, payloads.length); i++) {
      args.push(payloads[i]);
    }
  }

  if (passContext && args.length < expected) {
    args.push(ctx);
  }

  return {
    args,
    prepared: {
      params: preparedParams,
      query: preparedQuery,
      body: preparedBody,
    },
  };
}

function normalizeQuery(q: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!q || typeof q !== 'object') return {};
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(q)) {
    out[k] = v;
  }

  return out;
}

function coercePathValue(
  raw: string | undefined,
  hint?: 'string' | 'int' | 'number' | 'boolean' | 'uuid',
  paramName?: string,
): unknown {
  if (raw === undefined) return undefined;

  switch (hint) {
    case 'string':
      return raw;

    case 'boolean': {
      const s = raw.trim().toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
      throw new HttpError(400, `Invalid boolean for path param "${paramName ?? '?'}"`, {
        code: 'INVALID_PATH_PARAM',
        details: { param: paramName, expected: 'boolean', got: raw },
      });
    }

    case 'int': {
      if (!/^-?\d+$/.test(raw)) {
        throw new HttpError(400, `Invalid int for path param "${paramName ?? '?'}"`, {
          code: 'INVALID_PATH_PARAM',
          details: { param: paramName, expected: 'int', got: raw },
        });
      }
      const n = Number(raw);
      if (!Number.isSafeInteger(n)) {
        throw new HttpError(400, `Unsafe int for path param "${paramName ?? '?'}"`, {
          code: 'INVALID_PATH_PARAM',
          details: { param: paramName, expected: 'int(safe)', got: raw },
        });
      }
      return n;
    }

    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new HttpError(400, `Invalid number for path param "${paramName ?? '?'}"`, {
          code: 'INVALID_PATH_PARAM',
          details: { param: paramName, expected: 'number', got: raw },
        });
      }
      return n;
    }

    case 'uuid': {
      const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
      if (!ok) {
        throw new HttpError(400, `Invalid uuid for path param "${paramName ?? '?'}"`, {
          code: 'INVALID_PATH_PARAM',
          details: { param: paramName, expected: 'uuid', got: raw },
        });
      }
      return raw;
    }

    default:
      return raw;
  }
}
