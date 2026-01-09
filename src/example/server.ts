import express from 'express';
import { fileURLToPath } from 'url';

import { bootstrapControllers } from '../core/lifecycle/bootstrap.js';
import { buildRouter } from '../http/router.js';
import { createExpressAdapter } from '../adapters/express.js';
import { buildOpenApiSpec } from '../openapi/builder.js';
import { createSwaggerUiHandler } from '../openapi/swagger.js';
import { PingController } from './ping.controller.js';
import { UsersController } from './users.controller.js';
import { initExampleDatabase } from './sqlite.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  const registry = bootstrapControllers([PingController, UsersController]);
  buildRouter(registry, createExpressAdapter(app));

  const spec = buildOpenApiSpec(registry, {
    title: 'Adorn API Example',
    version: '0.1.0'
  });
  const swagger = createSwaggerUiHandler(spec);

  app.get(swagger.specPath, (_req, res) => {
    res.json(swagger.spec);
  });
  app.get('/docs', (_req, res) => {
    if (typeof res?.type === 'function') {
      res.type('html');
    }
    res.send(swagger.html);
  });

  return app;
};

export const start = async (port = 3000) => {
  await initExampleDatabase();
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Adorn API listening on http://127.0.0.1:${port}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error('Failed to start example server', error);
    process.exitCode = 1;
  });
}
