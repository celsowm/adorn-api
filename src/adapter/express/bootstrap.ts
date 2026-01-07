import express from "express";
import { type Server } from "http";
import { createExpressRouter, type CreateRouterOptions, setupSwagger } from "./index.js";
import path from "node:path";

/**
 * Options for bootstrapping an Express server with Adorn API
 */
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
  coerce?: CreateRouterOptions["coerce"];
}

/**
 * Result of bootstrapping an Express server
 */
export interface BootstrapResult {
  server: Server;
  app: express.Express;
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
}

/**
 * Bootstraps an Express server with the provided controllers and options
 * 
 * @param options - Configuration options for the server
 * @returns Promise that resolves with the server instance and metadata
 */
export function bootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  return new Promise((resolve, reject) => {
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
      coerce,
    } = options;

    if (controllers.length === 0) {
      reject(new Error("At least one controller must be provided to bootstrap()."));
      return;
    }

    const envPort = process.env.PORT;
    const port = userPort ?? (envPort !== undefined ? Number(envPort) : 3000);
    const host = userHost ?? process.env.HOST ?? "0.0.0.0";

    if (isNaN(port) || port < 0 || port > 65535) {
      reject(new Error(`Invalid port: ${port}. Port must be between 0 and 65535.`));
      return;
    }

    const absoluteArtifactsDir = path.isAbsolute(userArtifactsDir)
      ? userArtifactsDir
      : path.resolve(process.cwd(), userArtifactsDir);

    const app = express();
    app.use(express.json());

    createExpressRouter({
      controllers,
      artifactsDir: absoluteArtifactsDir,
      middleware,
      auth,
      coerce,
    }).then((router) => {
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

      const server = app.listen(port, host, () => {
        const displayHost = host === "0.0.0.0" ? "localhost" : host;
        const serverUrl = `http://${displayHost}:${port}`;

        console.log(`🚀 Server running on ${serverUrl}`);
        if (enableSwagger) {
          console.log(`📚 Swagger UI: ${serverUrl}${swaggerPath}`);
        }

        const result: BootstrapResult = {
          server,
          app,
          url: serverUrl,
          port,
          host,
          close: () => new Promise<void>((closeResolve) => {
            server.close(() => {
              console.log("Server closed gracefully");
              closeResolve();
            });
          })
        };

        resolve(result);
      });

      server.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error(`Port ${port} already in use. Please choose a different port.`));
        } else if (error.code === "EACCES") {
          reject(new Error(`Permission denied for port ${port}. Ports below 1024 require root privileges.`));
        } else {
          reject(new Error(`Failed to start server: ${error.message}`));
        }
      });
    }).catch(reject);
  });
}
