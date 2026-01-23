import express from "express";
import type { ExpressAdapterOptions } from "./types";
import { attachCors } from "./cors";
import { attachControllers } from "./controllers";
import { attachOpenApi } from "./openapi";
import { lifecycleRegistry } from "../../core/lifecycle";

export * from "./types";
export { attachCors } from "./cors";
export { attachControllers } from "./controllers";
export { attachOpenApi } from "./openapi";

/**
 * Creates an Express application with Adorn controllers.
 * @param options - Express adapter options
 * @returns Configured Express application
 */
export async function createExpressApp(options: ExpressAdapterOptions): Promise<express.Express> {
  const app = express();
  if (options.cors) {
    attachCors(app, options.cors === true ? {} : options.cors);
  }
  if (options.jsonBody ?? true) {
    app.use(express.json());
  }
  const inputCoercion = options.inputCoercion ?? "safe";
  await attachControllers(app, options.controllers, inputCoercion, options.multipart);
  if (options.openApi) {
    attachOpenApi(app, options.controllers, options.openApi);
  }
  await lifecycleRegistry.callOnApplicationBootstrap();
  return app;
}

/**
 * Trigger shutdown hooks for graceful application shutdown.
 * @param signal - Optional signal that triggered the shutdown (e.g., "SIGTERM")
 */
export async function shutdownApp(signal?: string): Promise<void> {
  await lifecycleRegistry.callShutdownHooks(signal);
  lifecycleRegistry.clear();
}
