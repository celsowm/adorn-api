import express, { type Express } from 'express';
import type { ControllerCtor } from '../../core/registry/types';
import type { Validator } from '../../contracts/validator';
import { buildRegistry } from '../../core/registry/buildRegistry';
import { applyRegistryToExpressRouter, type ApplyRoutesOptions } from './router';
import { adornErrorHandler } from './middleware/errorHandler';
import type { OpenApiBuildOptions } from '../../core/openapi/buildOpenApi';
import { serveOpenApi } from './swagger/serve';

export type CreateAdornExpressAppOptions = ApplyRoutesOptions & {
  controllers: ControllerCtor[];
  mountPath?: string;
  jsonBodyParser?: boolean;
  validator?: Validator;

  openapi?: (OpenApiBuildOptions & {
    enabled?: boolean;
    jsonPath?: string;
    docsPath?: string;
    swaggerUi?: boolean;
    swaggerUiConfig?: Record<string, unknown>;
  });
};

export function createAdornExpressApp(options: CreateAdornExpressAppOptions): Express {
  const app = express();

  if (options.jsonBodyParser ?? true) {
    app.use(express.json());
  }

  const registry = buildRegistry(options.controllers);

  const router = express.Router();
  applyRegistryToExpressRouter(router, registry, options);

  const oa = options.openapi;
  if (oa?.enabled ?? true) {
    if (oa?.title && oa?.version) {
      router.use(
        serveOpenApi(
          registry,
          { title: oa.title, version: oa.version, servers: oa.servers },
          {
            jsonPath: oa.jsonPath,
            docsPath: oa.docsPath,
            swaggerUi: oa.swaggerUi,
            swaggerUiConfig: oa.swaggerUiConfig,
          },
        ),
      );
    }
  }

  app.use(options.mountPath ?? '/', router);
  app.use(adornErrorHandler);

  return app;
}
