import express from 'express';
import { fileURLToPath } from 'url';

import { bootstrapExpressApp, registerOpenApiRoutes } from '../../adapters/express-app.js';
import { PingController } from './ping.controller.js';

export const createApp = () => {
  const app = express();
  app.use(express.json());

  const registry = bootstrapExpressApp(app, { controllers: [PingController] });
  registerOpenApiRoutes(app, {
    registry,
    info: {
      title: 'Adorn API Ping Example',
      version: '0.1.0'
    }
  });

  return app;
};

export const start = async (port = 3000) => {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`Ping example listening on http://127.0.0.1:${port}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().catch(error => {
    console.error('Failed to start ping example', error);
    process.exitCode = 1;
  });
}
