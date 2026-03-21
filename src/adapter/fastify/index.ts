import fastify from "fastify";
import type { FastifyAdapterOptions } from "./types";
import { attachControllers } from "./controllers";
import { attachOpenApi } from "./openapi";
import { lifecycleRegistry } from "../../core/lifecycle";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

export * from "./types";
export { attachControllers } from "./controllers";
export { attachOpenApi } from "./openapi";

/**
 * Creates a Fastify application with Adorn controllers.
 * @param options - Fastify adapter options
 * @returns Configured Fastify application
 */
export async function createFastifyApp(options: FastifyAdapterOptions): Promise<any> {
  const app = fastify({
    bodyLimit: options.bodyLimit
  });

  if (options.cors) {
    app.register(cors, options.cors === true ? {} : options.cors);
  }

  if (options.multipart) {
    app.register(multipart, {
      limits: {
        fileSize: typeof options.multipart === "object" ? options.multipart.maxFileSize : undefined
      }
    });
  }

  const inputCoercion = options.inputCoercion ?? "safe";
  await attachControllers(app, options.controllers, inputCoercion, options.multipart, options.validation);

  if (options.openApi) {
    attachOpenApi(app, options.controllers, options.openApi);
  }

  await lifecycleRegistry.callOnApplicationBootstrap();

  return app;
}

/**
 * Trigger shutdown hooks for graceful application shutdown.
 */
export async function shutdownApp(signal?: string): Promise<void> {
  await lifecycleRegistry.callShutdownHooks(signal);
  lifecycleRegistry.clear();
}
