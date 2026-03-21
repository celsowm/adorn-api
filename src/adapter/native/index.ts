import { createServer, IncomingMessage, ServerResponse } from "node:http";
import type { NativeAdapterOptions, NativeApp } from "./types";
import { registerControllers, dispatchRequest } from "./controllers";
import { registerOpenApi } from "./openapi";
import { lifecycleRegistry } from "../../core/lifecycle";
import { Router } from "./router";

export * from "./types";
export { registerControllers as attachControllers } from "./controllers";
export { registerOpenApi as attachOpenApi } from "./openapi";

/**
 * Creates a native Node.js application with Adorn controllers.
 * @param options - Native adapter options
 * @returns Native application object
 */
export async function createNativeApp(options: NativeAdapterOptions): Promise<NativeApp> {
  const router = new Router();
  const inputCoercion = options.inputCoercion ?? "safe";

  await registerControllers(router, options.controllers);

  if (options.openApi) {
    registerOpenApi(router, options.controllers, options.openApi);
  }

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const match = router.match(req.method || "GET", url.pathname);

    if (!match) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: `Not Found: ${req.method} ${url.pathname}` }));
      return;
    }

    const query: Record<string, any> = {};
    url.searchParams.forEach((value, key) => {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          query[key].push(value);
        } else {
          query[key] = [query[key], value];
        }
      } else {
        query[key] = value;
      }
    });

    let body: any = undefined;
    if (options.jsonBody !== false && (req.method === "POST" || req.method === "PUT" || req.method === "PATCH")) {
      try {
        body = await parseJsonBody(req, options.bodyLimit);
      } catch (error) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ message: "Invalid JSON body" }));
        return;
      }
    }

    await dispatchRequest(req, res, match, {
      inputCoercion,
      validation: options.validation,
      body,
      query
    });
  };

  await lifecycleRegistry.callOnApplicationBootstrap();

  return {
    handle,
    listen: (port: number, callback?: () => void) => {
      const server = createServer(handle);
      return server.listen(port, callback);
    }
  };
}

/**
 * Trigger shutdown hooks for graceful application shutdown.
 */
export async function shutdownApp(signal?: string): Promise<void> {
  await lifecycleRegistry.callShutdownHooks(signal);
  lifecycleRegistry.clear();
}

async function parseJsonBody(req: IncomingMessage, limit?: number): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      data += chunk;
      size += chunk.length;
      if (limit && size > limit) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}
