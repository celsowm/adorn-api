import { bootstrapControllers } from '../core/lifecycle/bootstrap.js';
import type { RouteRegistry } from '../core/metadata/types.js';
import { buildRouter, type RouterOptions } from '../http/router.js';
import type { OpenApiDocument, OpenApiInfo, OpenApiSpecOptions } from '../openapi/builder.js';
import { buildOpenApiSpec } from '../openapi/builder.js';
import { createSwaggerUiHandler } from '../openapi/swagger.js';
import { createExpressAdapter, type ExpressAdapterOptions } from './express.js';

export interface ExpressBootstrapOptions {
  controllers?: Function[];
  registry?: RouteRegistry;
  router?: RouterOptions;
  adapter?: ExpressAdapterOptions;
}

export interface ExpressOpenApiOptions extends OpenApiSpecOptions {
  registry: RouteRegistry;
  info: OpenApiInfo;
  specPath?: string;
  docsPath?: string;
}

export interface OpenApiRoutes {
  spec: OpenApiDocument;
  swagger: { specPath: string; spec: OpenApiDocument; html: string };
  docsPath: string;
}

const getRouteRegistrar = (
  app: unknown
): ((path: string, cb: (req: unknown, res: unknown) => void) => void) => {
  const instance = app as Record<string, unknown>;
  const fn = instance.get as
    | ((path: string, cb: (req: unknown, res: unknown) => void) => void)
    | undefined;
  if (typeof fn !== 'function') {
    throw new Error('registerOpenApiRoutes requires app.get to be a function');
  }
  return fn.bind(instance);
};

const sendJson = (res: any, payload: unknown): void => {
  if (typeof res?.json === 'function') {
    res.json(payload);
    return;
  }
  if (typeof res?.send === 'function') {
    res.send(payload);
  }
};

const sendHtml = (res: any, html: string): void => {
  if (typeof res?.type === 'function') {
    res.type('html');
  }
  if (typeof res?.send === 'function') {
    res.send(html);
  }
};

export const bootstrapExpressApp = (
  app: unknown,
  options: ExpressBootstrapOptions = {}
): RouteRegistry => {
  const registry = options.registry ?? bootstrapControllers(options.controllers);
  buildRouter(registry, createExpressAdapter(app, options.adapter), options.router);
  return registry;
};

export const registerOpenApiRoutes = (
  app: unknown,
  options: ExpressOpenApiOptions
): OpenApiRoutes => {
  const spec = buildOpenApiSpec(options.registry, options.info, {
    enhance: options.enhance,
    useDefaultEnhancers: options.useDefaultEnhancers
  });
  const swagger = createSwaggerUiHandler(spec, options.specPath);
  const docsPath = options.docsPath ?? '/docs';
  const get = getRouteRegistrar(app);

  get(swagger.specPath, (_req: unknown, res: any) => {
    sendJson(res, swagger.spec);
  });

  get(docsPath, (_req: unknown, res: any) => {
    sendHtml(res, swagger.html);
  });

  return { spec, swagger, docsPath };
};
