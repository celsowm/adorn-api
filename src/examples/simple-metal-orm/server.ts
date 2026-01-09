import express from 'express';
import { fileURLToPath } from 'url';

import { bootstrapExpressApp, registerOpenApiRoutes } from '../../adapters/express-app.js';
import { getEntitySchemaComponents } from '../../metal/entity.js';
import { mergeOpenApiComponents } from '../../metal/schema-bridge.js';
import { PingController } from './ping.controller.js';
import { UsersController } from './users.controller.js';
import { initExampleDatabase } from './sqlite.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  const registry = bootstrapExpressApp(app, { controllers: [PingController, UsersController] });
  registerOpenApiRoutes(app, {
    registry,
    info: {
      title: 'Adorn API Simple Metal ORM Example',
      version: '0.1.0'
    },
    enhance: spec => {
      spec.components = mergeOpenApiComponents(spec.components, getEntitySchemaComponents());
    }
  });

  return app;
};

export const start = async (port = 3000) => {
  await initExampleDatabase();
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Simple Metal ORM example listening on http://127.0.0.1:${port}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error('Failed to start simple metal ORM example', error);
    process.exitCode = 1;
  });
}
