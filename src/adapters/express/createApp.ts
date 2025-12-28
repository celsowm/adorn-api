import express, { type Express, type Router } from 'express';
import type { ControllerCtor, Registry } from '../../core/registry/types.js';
import type { Validator } from '../../contracts/validator.js';
import { buildRegistry } from '../../core/registry/buildRegistry.js';
import { applyRegistryToExpressRouter, type ApplyRoutesOptions } from './router.js';
import {
  adornErrorHandler,
  createAdornExpressErrorHandler,
  type AdornErrorHandlerOptions,
} from './middleware/errorHandler.js';
import type { OpenApiBuildOptions } from '../../core/openapi/buildOpenApi.js';
import { serveOpenApi } from './swagger/serve.js';

export type AdornOpenApiOptions = OpenApiBuildOptions & {
  enabled?: boolean;
  jsonPath?: string;
  docsPath?: string;
  swaggerUi?: boolean;
  swaggerUiConfig?: Record<string, unknown>;
};

export type CreateAdornExpressRouterOptions = ApplyRoutesOptions & {
  controllers: ControllerCtor[];
  jsonBodyParser?: boolean;
  validator?: Validator;
  errorHandler?: AdornErrorHandlerOptions | false;
  openapi?: AdornOpenApiOptions;
};

export type CreateAdornExpressRouterResult = {
  router: Router;
  registry: Registry;
};

export type CreateAdornExpressAppOptions = CreateAdornExpressRouterOptions & {
  mountPath?: string;
};

export function createAdornExpressApp(options: CreateAdornExpressAppOptions): Express {
  const app = express();
  const { router } = createAdornExpressRouter(options);
  app.use(options.mountPath ?? '/', router);
  return app;
}

export function createAdornExpressRouter(
  options: CreateAdornExpressRouterOptions,
): CreateAdornExpressRouterResult {
  const router = express.Router();

  if (options.jsonBodyParser ?? true) {
    router.use(express.json());
  }

  const registry = buildRegistry(options.controllers);
  applyRegistryToExpressRouter(router, registry, options);

  const oa = options.openapi;
  if (oa?.enabled ?? true) {
    if (oa?.title && oa?.version) {
      const openApiOptions: OpenApiBuildOptions = {
        title: oa.title,
        version: oa.version,
        ...(oa.servers !== undefined ? { servers: oa.servers } : {}),
      };
      const serveOptions = {
        ...(oa.jsonPath !== undefined ? { jsonPath: oa.jsonPath } : {}),
        ...(oa.docsPath !== undefined ? { docsPath: oa.docsPath } : {}),
        ...(oa.swaggerUi !== undefined ? { swaggerUi: oa.swaggerUi } : {}),
        ...(oa.swaggerUiConfig !== undefined ? { swaggerUiConfig: oa.swaggerUiConfig } : {}),
      };

      router.use(serveOpenApi(registry, openApiOptions, serveOptions));
    }
  }

  if (options.errorHandler !== false) {
    const handler = options.errorHandler
      ? createAdornExpressErrorHandler(options.errorHandler)
      : adornErrorHandler;
    router.use(handler);
  }

  return { router, registry };
}
