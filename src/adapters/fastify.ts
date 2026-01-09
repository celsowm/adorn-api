import type { RouteDefinition } from '../core/metadata/types.js';
import type { HttpContext } from '../http/context.js';
import type { RouterAdapter, RouteHandler } from '../http/router.js';

export const createFastifyAdapter = (app: unknown): RouterAdapter => {
  const instance = app as Record<string, unknown>;

  return {
    addRoute(route: RouteDefinition, handler: RouteHandler): void {
      const routeFn = instance.route as
        | ((opts: { method: string; url: string; handler: (req: unknown, res: unknown) => void }) => void)
        | undefined;

      if (typeof routeFn !== 'function') {
        throw new Error('Fastify adapter requires app.route');
      }

      routeFn.call(instance, {
        method: route.method.toUpperCase(),
        url: route.fullPath,
        handler: async (req: any, res: any) => {
          const ctx: HttpContext = {
            request: req,
            response: res,
            params: req?.params ?? {},
            query: req?.query ?? {},
            headers: req?.headers ?? {},
            body: req?.body,
            state: {}
          };
          const result = await handler(ctx);
          if (result !== undefined && typeof res?.send === 'function') {
            res.send(result);
          }
        }
      });
    }
  };
};
