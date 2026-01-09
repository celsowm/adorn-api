import express from 'express';
import { fileURLToPath } from 'url';

import { bootstrapExpressApp, registerOpenApiRoutes } from '../../adapters/express-app.js';
import { TodosController } from './todos.controller.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  const registry = bootstrapExpressApp(app, { controllers: [TodosController] });
  registerOpenApiRoutes(app, {
    registry,
    info: {
      title: 'Adorn API Mocked Example',
      version: '0.1.0'
    }
  });

  return app;
};

export const start = async (port = 3000) => {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Mocked example listening on http://127.0.0.1:${port}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error('Failed to start mocked example', error);
    process.exitCode = 1;
  });
}
