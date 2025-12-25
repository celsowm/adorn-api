import express from 'express';
import type { Express, Request, Response } from 'express';
import { collectManifest } from './ir.js';
import { ValidationError, RouteConfigError, HttpError } from './errors.js';
import { parseInclude, validateInclude } from './include.js';
import type { IncludeTree } from './include.js';
import { runGuards } from './guards.js';
import { validateOrThrow } from './schema.js';

export type RequestContext = {
  req: Request;
  res: Response;
  input: {
    params: unknown;
    query: unknown;
    body: unknown;
    include: {
      tokens: string[];
      tree: IncludeTree;
    };
  };
  controller: unknown;
};

export type RegisterOptions = {
  resolveController?: (ctor: Function) => unknown;
  validateResponse?: boolean;
};

function toExpressPath(openapiPath: string): string {
  return openapiPath.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
}

function omitInclude(query: any): { includeRaw: unknown; querySansInclude: any } {
  if (!query || typeof query !== 'object')
    return { includeRaw: undefined, querySansInclude: query };
  const { include, ...rest } = query as any;
  return { includeRaw: include, querySansInclude: rest };
}

export function registerControllers(
  app: Express,
  controllers: Function[],
  opts: RegisterOptions = {}
): Express {
  const manifest = collectManifest(controllers);
  const resolve = opts.resolveController ?? ((ctor: Function) => new (ctor as any)());

  for (const route of manifest.routes) {
    const expressPath = toExpressPath(route.path);

    const handler = async (req: Request, res: Response) => {
      try {
        const { includeRaw, querySansInclude } = omitInclude(req.query);
        const include = validateInclude(parseInclude(includeRaw), route.includePolicy);

        const params = route.schemas.params
          ? validateOrThrow(route.schemas.params, req.params, 'params')
          : {};
        const query = validateOrThrow(route.schemas.query, querySansInclude, 'query');
        const body = route.schemas.body
          ? validateOrThrow(route.schemas.body, req.body, 'body')
          : undefined;

        const controller = resolve(route.controller);

        const ctx: RequestContext = {
          req,
          res,
          controller,
          input: { params, query, body, include },
        };

        await runGuards(route.guards, ctx);

        const fn = (controller as any)[route.handlerName];
        if (typeof fn !== 'function')
          throw new RouteConfigError(`Handler not found: ${route.handlerName}`);

        const result = await fn.call(controller, ctx);

        // Allow returning either plain body OR {status, body, headers}
        // Special case: if result is undefined (void return), use 204 for EmptyResponse
        const payload =
          result && typeof result === 'object' && 'status' in result && 'body' in result
            ? (result as { status: number; body: unknown; headers?: Record<string, string> })
            : { status: result === undefined ? 204 : 200, body: result as unknown };

        if (payload.headers) {
          for (const [k, v] of Object.entries(payload.headers)) res.setHeader(k, v);
        }

        if (opts.validateResponse) {
          validateOrThrow(route.schemas.response, payload.body, 'response');
        }

        if (payload.status === 204) return res.status(204).end();
        return res.status(payload.status).json(payload.body);
      } catch (err) {
        if (err instanceof ValidationError) {
          return res.status(400).json(err.toJSON());
        }
        if (err instanceof HttpError) {
          return res.status(err.status).json(err.toJSON());
        }
        if (err instanceof RouteConfigError) {
          return res.status(500).json(err.toJSON());
        }
        const isProduction = process.env.NODE_ENV === 'production';
        return res.status(500).json({
          error: 'InternalError',
          message: isProduction ? 'An unexpected error occurred' : err instanceof Error ? err.message : 'unknown error',
          status: 500,
        });
      }
    };

    switch (route.method) {
      case 'GET':
        app.get(expressPath, handler);
        break;
      case 'POST':
        app.post(expressPath, handler);
        break;
      case 'PUT':
        app.put(expressPath, handler);
        break;
      case 'PATCH':
        app.patch(expressPath, handler);
        break;
      case 'DELETE':
        app.delete(expressPath, handler);
        break;
    }
  }

  return app;
}

// Convenience builder for in-memory apps (useful in tests)
export function buildApp(controllers: Function[], opts: RegisterOptions = {}): Express {
  const app = express();
  app.use(express.json());
  registerControllers(app, controllers, opts);
  return app;
}
