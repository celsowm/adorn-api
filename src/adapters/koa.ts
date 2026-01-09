import type { RouteDefinition } from '../core/metadata/types.js';
import type { HttpContext } from '../http/context.js';
import type { RouterAdapter, RouteHandler } from '../http/router.js';

export const createKoaAdapter = (router: unknown): RouterAdapter => {
  const instance = router as Record<string, unknown>;

  return {
    addRoute(route: RouteDefinition, handler: RouteHandler): void {
      const fn = instance[route.method] as ((path: string, cb: (ctx: unknown) => unknown) => void) | undefined;
      if (typeof fn !== 'function') {
        throw new Error(`Koa adapter requires router.${route.method} to be a function`);
      }

      fn.call(instance, route.fullPath, async (koaCtx: any) => {
        const ctx: HttpContext = {
          request: koaCtx?.request,
          response: koaCtx?.response,
          params: koaCtx?.params ?? {},
          query: koaCtx?.query ?? {},
          headers: koaCtx?.headers ?? {},
          body: koaCtx?.request?.body ?? koaCtx?.body,
          state: koaCtx?.state ?? {}
        };
        const result = await handler(ctx);
        if (result !== undefined) {
          koaCtx.body = result;
        }
      });
    }
  };
};
