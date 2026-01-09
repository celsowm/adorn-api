import type { RouteDefinition } from '../core/metadata/types.js';
import type { HttpContext } from '../http/context.js';
import { isHttpError } from '../http/errors.js';
import type { RouterAdapter, RouteHandler } from '../http/router.js';

export interface ExpressAdapterOptions {
  queryParser?: 'simple' | 'extended' | false;
  sendResult?: (res: any, result: unknown, ctx: HttpContext) => void;
  onError?: (error: unknown, res: any, ctx: HttpContext) => void;
}

const setStatus = (res: any, status: number): void => {
  const fn = res?.status as ((code: number) => void) | undefined;
  if (typeof fn === 'function') {
    fn.call(res, status);
  }
};

const defaultSendResult = (res: any, result: unknown): void => {
  if (result === undefined || res?.headersSent) return;
  if (typeof res?.json === 'function') {
    res.json(result);
    return;
  }
  if (typeof res?.send === 'function') {
    res.send(result);
  }
};

const defaultOnError = (error: unknown, res: any): void => {
  if (isHttpError(error)) {
    setStatus(res, error.status);
    const payload = error.payload ?? { message: error.message };
    defaultSendResult(res, payload);
    return;
  }
  setStatus(res, 500);
  defaultSendResult(res, { message: 'Internal Server Error' });
};

export const createExpressAdapter = (
  app: unknown,
  options: ExpressAdapterOptions = {}
): RouterAdapter => {
  const instance = app as Record<string, unknown>;
  const setFn = instance.set as ((key: string, value: unknown) => void) | undefined;

  if (typeof setFn === 'function') {
    const parser = options.queryParser ?? 'extended';
    if (parser !== undefined) {
      setFn.call(instance, 'query parser', parser);
    }
  }

  const sendResult = options.sendResult ?? ((res: any, result: unknown) => defaultSendResult(res, result));
  const onError = options.onError ?? ((error: unknown, res: any) => defaultOnError(error, res));

  return {
    addRoute(route: RouteDefinition, handler: RouteHandler): void {
      const fn = instance[route.method] as
        | ((path: string, cb: (req: unknown, res: unknown) => void) => void)
        | undefined;
      if (typeof fn !== 'function') {
        throw new Error(`Express adapter requires app.${route.method} to be a function`);
      }

      fn.call(instance, route.fullPath, async (req: any, res: any) => {
        const ctx: HttpContext = {
          request: req,
          response: res,
          params: req?.params ?? {},
          query: req?.query ?? {},
          headers: req?.headers ?? {},
          body: req?.body,
          state: {}
        };

        try {
          const result = await handler(ctx);
          sendResult(res, result, ctx);
        } catch (error) {
          onError(error, res, ctx);
        }
      });
    }
  };
};
