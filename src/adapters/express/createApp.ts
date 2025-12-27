import express, { type Express } from 'express';
import type { ControllerCtor } from '../../core/registry/types';
import { buildRegistry } from '../../core/registry/buildRegistry';
import { applyRegistryToExpressRouter, type ApplyRoutesOptions } from './router';
import { adornErrorHandler } from './middleware/errorHandler';

export type CreateAdornExpressAppOptions = ApplyRoutesOptions & {
  controllers: ControllerCtor[];
  mountPath?: string;
  jsonBodyParser?: boolean;
};

export function createAdornExpressApp(options: CreateAdornExpressAppOptions): Express {
  const app = express();

  if (options.jsonBodyParser ?? true) {
    app.use(express.json());
  }

  const registry = buildRegistry(options.controllers);

  const router = express.Router();
  applyRegistryToExpressRouter(router, registry, options);

  app.use(options.mountPath ?? '/', router);
  app.use(adornErrorHandler);

  return app;
}
