import type { NextFunction, Request, Response, Router } from 'express';
import type { Registry, RouteEntry, ControllerCtor } from '../../core/registry/types.js';
import { createExpressContext } from './transport/request.js';
import { sendJson, sendReply } from './transport/response.js';
import { bindArgs } from '../../core/binding/binder.js';
import { ValidationError } from '../../core/errors/validation-error.js';
import type { Schema } from '../../validation/native/schema.js';
import { isReply } from '../../contracts/reply.js';
import { pickSuccessStatus } from '../../core/responses/pickStatus.js';
import type { RouteOptions } from '../../contracts/route-options.js';

export type ControllerFactory = (ctor: ControllerCtor, req: Request, res: Response) => unknown;

export type ApplyRoutesOptions = {
  lifecycle?: 'singleton' | 'transient';
  controllerFactory?: ControllerFactory;
  passContext?: boolean;
};

function toExpressPath(template: string): string {
  return template.replace(/\{([^}]+)\}/g, (_m, name) => `:${String(name)}`);
}

type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;
type ControllerInstance = Record<string, unknown>;

function wrapAsync(fn: RouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const p = fn(req, res, next);
      const promise = p as Promise<unknown> | undefined;
      if (promise && typeof promise.then === 'function') promise.catch(next);
    } catch (e) {
      next(e);
    }
  };
}

function methodToExpress(router: Router, method: RouteEntry['method']) {
  switch (method) {
    case 'GET':
      return router.get.bind(router);
    case 'POST':
      return router.post.bind(router);
    case 'PUT':
      return router.put.bind(router);
    case 'PATCH':
      return router.patch.bind(router);
    case 'DELETE':
      return router.delete.bind(router);
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
}

export function applyRegistryToExpressRouter(
  router: Router,
  registry: Registry,
  opts: ApplyRoutesOptions = {},
): void {
  const lifecycle = opts.lifecycle ?? 'singleton';
  const passContext = opts.passContext ?? true;

  const singletonCache = new Map<ControllerCtor, ControllerInstance>();

  const getControllerInstance = (ctor: ControllerCtor, req: Request, res: Response): ControllerInstance => {
    if (opts.controllerFactory) return opts.controllerFactory(ctor, req, res) as ControllerInstance;

    if (lifecycle === 'transient') return new ctor() as ControllerInstance;

    const cached = singletonCache.get(ctor);
    if (cached) return cached;

    const created = new ctor() as ControllerInstance;
    singletonCache.set(ctor, created);
    return created;
  };

  for (const r of registry.routes) {
    const expressPath = toExpressPath(r.fullPath);

    const register = methodToExpress(router, r.method);

    register(
      expressPath,
      wrapAsync(async (req, res) => {
        const controller = getControllerInstance(r.controller, req, res);

        const handler = controller?.[r.handlerName];
        if (typeof handler !== 'function') {
          throw Object.assign(new Error(`Handler not found: ${r.controller.name}.${r.handlerName}`), {
            status: 500,
          });
        }

        const handlerFn = handler as (...args: unknown[]) => unknown;
        const ctx = createExpressContext(req, res);

        const { args, prepared } = bindArgs(r, handlerFn, ctx, {
          passContext,
          coerce: 'smart',
          csv: true,
        });

        type ValidationSchemas = {
          params?: Schema<Record<string, unknown>>;
          query?: Schema<Record<string, unknown>>;
          body?: Schema<unknown>;
        };

        const validate = (r.options as { validate?: ValidationSchemas } | undefined)?.validate;

        if (validate?.params) {
          const res = validate.params.parse(prepared.params, ['params']);
          if (!res.ok) throw ValidationError.fromIssues(res.issues, 'Params validation failed');
          prepared.params = res.value;
        }

        if (validate?.query) {
          const res = validate.query.parse(prepared.query, ['query']);
          if (!res.ok) throw ValidationError.fromIssues(res.issues, 'Query validation failed');
          prepared.query = res.value;
        }

        if (validate?.body) {
          const res = validate.body.parse(prepared.body, ['body']);
          if (!res.ok) throw ValidationError.fromIssues(res.issues, 'Body validation failed');
          prepared.body = res.value;
        }

        const result = await handlerFn.apply(controller, args);

        if (res.headersSent) return;

        if (isReply(result)) {
          sendReply(res, result);
          return;
        }

        const routeOptions = (r.options ?? {}) as RouteOptions<string>;
        const status = pickSuccessStatus(r.method, routeOptions.responses, routeOptions.successStatus);

        sendJson(res, status, result);
      }),
    );
  }
}
