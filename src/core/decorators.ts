import { ensureDecoratorMetadata } from "../runtime/metadataPolyfill.js";
import type { SchemaRef } from "./schema.js";
import type { Guard, IncludePolicy } from "./metadata.js";
import { pushRouteStub, writeControllerMeta } from "./metadata.js";
import { RouteConfigError } from "./errors.js";

ensureDecoratorMetadata();

export type ControllerOptions = {
  tags?: string[];
};

export function Controller(basePath: string, opts: ControllerOptions = {}) {
  return function <T extends Function>(value: T, context: ClassDecoratorContext) {
    writeControllerMeta(context.metadata, { basePath, tags: opts.tags });
    return value;
  };
}

export type RouteOptions = {
  params?: SchemaRef;
  query: SchemaRef;
  body?: SchemaRef;
  response: SchemaRef;
  includePolicy?: IncludePolicy;
  guards?: Guard[];
};

function http(method: string, path: string, opts: RouteOptions) {
  return function (value: Function, context: ClassMethodDecoratorContext) {
    if (context.kind !== "method") throw new RouteConfigError(`@${method} can only decorate methods`);

    if (typeof context.name !== "string") {
      throw new RouteConfigError(`Decorated method name must be a string (got symbol)`);
    }

    pushRouteStub(context.metadata, {
      method,
      path,
      handlerName: context.name,
      schemas: {
        params: opts.params,
        query: opts.query,
        body: opts.body,
        response: opts.response
      },
      includePolicy: opts.includePolicy,
      guards: opts.guards ?? []
    });

    // Return void to satisfy TypeScript decorator requirements
    return;
  };
}

export const Get = (path: string, opts: RouteOptions) => http("GET", path, opts);
export const Post = (path: string, opts: RouteOptions) => http("POST", path, opts);
export const Put = (path: string, opts: RouteOptions) => http("PUT", path, opts);
export const Patch = (path: string, opts: RouteOptions) => http("PATCH", path, opts);
export const Delete = (path: string, opts: RouteOptions) => http("DELETE", path, opts);