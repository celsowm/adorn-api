import express from "express";
import { createExpressRouter, type CreateRouterOptions, setupSwagger, type SetupSwaggerOptions } from "./index.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BootstrapOptions {
  controllers: Array<new (...args: any[]) => any>;
  port?: number;
  host?: string;
  artifactsDir?: string;
  enableSwagger?: boolean;
  swaggerPath?: string;
  swaggerJsonPath?: string;
  middleware?: CreateRouterOptions["middleware"];
  auth?: CreateRouterOptions["auth"];
}

export async function bootstrap(options: BootstrapOptions): Promise<void> {
  const {
    controllers,
    port: userPort,
    host: userHost,
    artifactsDir: userArtifactsDir = ".adorn",
    enableSwagger = true,
    swaggerPath = "/docs",
    swaggerJsonPath = "/docs/openapi.json",
    middleware,
    auth,
  } = options;

  if (controllers.length === 0) {
    throw new Error("At least one controller must be provided to bootstrap().");
  }

  const envPort = process.env.PORT;
  const port = userPort ?? (envPort !== undefined ? Number(envPort) : 3000);
  const host = userHost ?? process.env.HOST ?? "0.0.0.0";

  if (isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}. Port must be between 0 and 65535.`);
  }

  const absoluteArtifactsDir = isAbsolute(userArtifactsDir)
    ? userArtifactsDir
    : resolve(process.cwd(), userArtifactsDir);

  const app = express();
  app.use(express.json());

  const router = await createExpressRouter({
    controllers,
    artifactsDir: absoluteArtifactsDir,
    middleware,
    auth,
  });

  app.use(router);

  if (enableSwagger) {
    const displayHost = host === "0.0.0.0" ? "localhost" : host;
    const serverUrl = `http://${displayHost}:${port}`;

    app.use(
      setupSwagger({
        artifactsDir: absoluteArtifactsDir,
        jsonPath: swaggerJsonPath,
        uiPath: swaggerPath,
        swaggerOptions: {
          servers: [{ url: serverUrl }],
        },
      })
    );
  }

  app.listen(port, host, () => {
    const displayHost = host === "0.0.0.0" ? "localhost" : host;
    const serverUrl = `http://${displayHost}:${port}`;
    
    console.log(`🚀 Server running on ${serverUrl}`);
    if (enableSwagger) {
      console.log(`📚 Swagger UI: ${serverUrl}${swaggerPath}`);
    }
  });

  return new Promise(() => {});
}
