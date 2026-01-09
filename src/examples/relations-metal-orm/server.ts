import express from 'express';
import { fileURLToPath } from 'url';

import { bootstrapExpressApp, registerOpenApiRoutes } from '../../adapters/express-app.js';
import { getEntitySchemaComponents } from '../../metal/entity.js';
import { mergeOpenApiComponents } from '../../metal/schema-bridge.js';
import { AuthorsController } from './authors.controller.js';
import { initExampleDatabase } from './sqlite.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  const registry = bootstrapExpressApp(app, { controllers: [AuthorsController] });
  registerOpenApiRoutes(app, {
    registry,
    info: {
      title: 'Adorn API Relations Example',
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
    console.log(`Relations example listening on http://127.0.0.1:${port}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error('Failed to start relations example', error);
    process.exitCode = 1;
  });
}
