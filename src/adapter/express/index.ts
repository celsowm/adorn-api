import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ManifestV1 } from "../../compiler/manifest/format.js";
import { bindRoutes } from "./merge.js";
import type { BoundRoute } from "./merge.js";

export interface CreateRouterOptions {
  controllers: Array<new (...args: any[]) => any>;
  artifactsDir?: string;
  manifest?: ManifestV1;
}

export function createExpressRouter(options: CreateRouterOptions): Router {
  const { controllers, artifactsDir = ".adorn" } = options;

  const manifest: ManifestV1 = options.manifest ?? JSON.parse(
    readFileSync(resolve(artifactsDir, "manifest.json"), "utf-8")
  );

  const routes = bindRoutes({ controllers, manifest });

  const router = Router();

  const instanceCache = new Map<Function, any>();

  function getInstance(Ctor: new (...args: any[]) => any): any {
    if (!instanceCache.has(Ctor)) {
      instanceCache.set(Ctor, new Ctor());
    }
    return instanceCache.get(Ctor);
  }

  for (const route of routes) {
    const method = route.httpMethod.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";

    router[method](route.fullPath, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const instance = getInstance(route.controllerCtor);
        const handler = instance[route.methodName];

        if (typeof handler !== "function") {
          throw new Error(`Method ${route.methodName} not found on controller`);
        }

        const args: any[] = [];

        if (route.args.body) {
          args[route.args.body.index] = req.body;
        }

        const result = await handler.apply(instance, args);

        const primaryResponse = route.responses[0];
        const status = primaryResponse?.status ?? 200;

        res.status(status).json(result);
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}
