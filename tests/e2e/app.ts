import express from 'express';
import type { Express } from 'express';
import { registerControllers } from '../../src/index.js';
import { UsersController } from './controllers/users.controller.js';

export function buildTestApp(): Express {
  const app = express();
  app.use(express.json());

  registerControllers(app, [UsersController], {
    validateResponse: true,
    resolveController: (ctor) => new (ctor as any)(),
  });

  return app;
}
