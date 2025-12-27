import type { NextFunction, Request, Response, Router } from 'express';
import type { Registry, RouteEntry, ControllerCtor } from '../../core/registry/types';
import { createExpressContext } from './transport/request';
import { sendJson } from './transport/response';
import { bindArgs } from '../../core/binding/binder';

export type ControllerFactory = (ctor: ControllerCtor, req: Request, res: Response) => any;

export type ApplyRoutesOptions = {
  lifecycle?: 'singleton' | 'transient';
  controllerFactory?: ControllerFactory;
  passContext?: boolean;
};

function toExpressPath(template: string): string {
  return template.replace(/\{([^}]+)\}/g, (_m, name) => `:${String(name)}`);
}

function wrapAsync(fn: (req: Request, res: Response, next: NextFunction) => any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const p = fn(req, res, next);
      if (p && typeof (p as any).then === 'function') (p as Promise<any>).catch(next);
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

  const singletonCache = new Map<ControllerCtor, any>();

  const getControllerInstance = (ctor: ControllerCtor, req: Request, res: Response) => {
    if (opts.controllerFactory) return opts.controllerFactory(ctor, req, res);

    if (lifecycle === 'transient') return new ctor();

    const cached = singletonCache.get(ctor);
    if (cached) return cached;

    const created = new ctor();
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

        const ctx = createExpressContext(req, res);

        const args = bindArgs(r, handler, ctx, {
          passContext,
          coerce: 'smart',
          csv: true,
        });

        const result = await handler.apply(controller, args);

        if (res.headersSent) return;

        sendJson(res, 200, result);
      }),
    );
  }
}
