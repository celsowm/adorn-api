import type { RequestContext } from '../../contracts/context.js';
import type { RouteOptions, ScalarHint, ArgBinding } from '../../contracts/route-options.js';
import type { RouteEntry } from '../registry/types.js';
import { conventionForMethod } from './rules/inferFromHttpMethod.js';
import { getPathTokenNames } from './rules/inferFromPath.js';
import type { CoerceMode } from './coerce/primitives.js';
import { coerceObjectSmart, coerceValueSmart } from './coerce/arrays.js';
import { HttpError } from '../errors/http-error.js';

type HandlerFunction = (...args: unknown[]) => unknown;

type RouteOptionsAny = RouteOptions<string>;

function mergedPathHints(route: RouteEntry): Record<string, ScalarHint | undefined> {
  const ro = (route.options ?? {}) as RouteOptionsAny;

  const optionHints = ro.bindings?.path ?? {};

  const metaHints = route.bindings?.byMethod?.[route.handlerName]?.path ?? {};

  return { ...optionHints, ...metaHints };
}

/**
 * Prepared binding data after argument binding.
 * Contains the processed params, query, and body data.
 */
export type BindingPrepared = {
  /** Path parameters extracted and coerced from the URL */
  params: Record<string, unknown>;
  /** Query parameters extracted and processed from the URL query string */
  query: Record<string, unknown>;
  /** Request body parsed and processed */
  body: unknown;
};

/**
 * Result of the bindArgs function containing:
 * - args: The arguments to pass to the handler function
 * - prepared: The processed binding data
 */
export type BindArgsResult = {
  /** Arguments to pass to the handler function in order */
  args: unknown[];
  /** Prepared binding data for reference */
  prepared: BindingPrepared;
};

/**
 * Options for the bindArgs function to control binding behavior.
 */
export type BindOptions = {
  /** Coercion mode for automatic type conversion ('smart', 'strict', or 'none') */
  coerce?: CoerceMode;
  /** Whether to parse CSV values in query parameters */
  csv?: boolean;
  /** Whether to pass the request context as the last argument */
  passContext?: boolean;
};

/**
 * Binds request data to handler function arguments based on route configuration.
 *
 * This function automatically maps path parameters, query parameters, and request body
 * to the handler function arguments based on the route's binding configuration and
 * HTTP method conventions.
 *
 * @param route - The route entry containing metadata about the handler
 * @param handler - The handler function to bind arguments for
 * @param ctx - The request context containing params, query, and body
 * @param opts - Binding options to control behavior
 * @returns Object containing args to pass to handler and prepared binding data
 *
 * @example
 * ```typescript
 * // For a route like: @Get('/users/:id')
 * // With handler: async getUser(id: string, ctx: RequestContext)
 * const { args } = bindArgs(route, handler, requestContext);
 * const result = await handler(...args); // Automatically passes id and ctx
 * ```
 *
 * @example
 * ```typescript
 * // For a POST route with body
 * // @Post('/users')
 * // async createUser(userData: CreateUserDto)
 * const { args } = bindArgs(route, handler, requestContext);
 * const result = await handler(...args); // Automatically passes parsed body
 * ```
 *
 * @see RouteEntry for route metadata structure
 * @see RequestContext for request data structure
 */
export function bindArgs(
  route: RouteEntry,
  handler: HandlerFunction,
  ctx: RequestContext,
  opts: BindOptions = {},
): BindArgsResult {
  const passContext = opts.passContext ?? true;
  const coerceMode: CoerceMode = opts.coerce ?? 'smart';
  const csv = opts.csv ?? true;

  const rawParams = ctx.params ?? {};
  const preparedParams: Record<string, unknown> = {};

  const preparedQuery = coerceMode === 'smart'
    ? coerceObjectSmart(normalizeQuery(ctx.query), { csv })
    : normalizeQuery(ctx.query);

  const preparedBody = coerceMode === 'smart'
    ? coerceValueSmart(ctx.body, { csv })
    : ctx.body;

  const ro = (route.options ?? {}) as RouteOptionsAny;
  const argPlan = ro.bindings?.args;

  if (Array.isArray(argPlan) && argPlan.length) {
    const pathHints = mergedPathHints(route);
    const args: unknown[] = [];

    for (const b of argPlan as ArgBinding[]) {
      if (b.kind === 'path') {
        const raw = rawParams[b.name];
        const hint = b.type ?? pathHints[b.name];
        const value = coercePathValue(raw, hint, b.name);
        preparedParams[b.name] = value;
        args.push(value);
        continue;
      }

      if (b.kind === 'query') {
        if ('name' in b) {
          const name = (b as { kind: 'query'; name: string; type?: ScalarHint }).name;
          const raw = preparedQuery[name];
          const hint = (b as { kind: 'query'; name: string; type?: ScalarHint }).type;
          const value = coerceScalar(raw, hint, 'query param', name);
          args.push(value);
        } else {
          args.push(preparedQuery);
        }
        continue;
      }

      if (b.kind === 'body') {
        args.push(preparedBody);
        continue;
      }

      if (b.kind === 'ctx') {
        args.push(ctx);
        continue;
      }
    }

    for (const [k, v] of Object.entries(rawParams)) {
      if (!(k in preparedParams)) preparedParams[k] = v;
    }

    return {
      args,
      prepared: { params: preparedParams, query: preparedQuery, body: preparedBody },
    };
  }

  const tokenNames = getPathTokenNames(route.fullPath);

  const pathTypes = mergedPathHints(route);

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

function coerceScalar(raw: unknown, hint: ScalarHint | undefined, where: string, name: string): unknown {
  if (raw === undefined || raw === null) return raw;

  if (hint === 'string') return String(raw);

  if (hint === 'boolean') {
    if (raw === true || raw === false) return raw;
    const s = String(raw).toLowerCase().trim();
    if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
    throw new HttpError(400, `Invalid boolean for ${where} "${name}": ${String(raw)}`);
  }

  if (hint === 'int' || hint === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw));
    if (!Number.isFinite(n)) throw new HttpError(400, `Invalid number for ${where} "${name}": ${String(raw)}`);
    if (hint === 'int') {
      if (!Number.isSafeInteger(n)) throw new HttpError(400, `Unsafe int for ${where} "${name}": ${String(raw)}`);
    }
    return n;
  }

  if (hint === 'uuid') {
    const s = String(raw);
    const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
    if (!ok) throw new HttpError(400, `Invalid uuid for ${where} "${name}": ${s}`);
    return s;
  }

  return String(raw);
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
