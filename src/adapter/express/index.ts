import express from "express";
import type { ExpressAdapterOptions } from "./types";
import { attachCors } from "./cors";
import { attachControllers } from "./controllers";
import { attachOpenApi } from "./openapi";

export * from "./types";
export { attachCors } from "./cors";
export { attachControllers } from "./controllers";
export { attachOpenApi } from "./openapi";

/**
 * Creates an Express application with Adorn controllers.
 * @param options - Express adapter options
 * @returns Configured Express application
 */
export function createExpressApp(options: ExpressAdapterOptions): express.Express {
  const app = express();
  if (options.cors) {
    attachCors(app, options.cors === true ? {} : options.cors);
  }
  if (options.jsonBody ?? true) {
    app.use(express.json());
  }
  const inputCoercion = options.inputCoercion ?? "safe";
  attachControllers(app, options.controllers, inputCoercion);
  if (options.openApi) {
    attachOpenApi(app, options.controllers, options.openApi);
  }
  return app;
}
