import { getBucket } from "../runtime/metadata/bucket.js";
import type { HttpMethod } from "../runtime/metadata/types.js";

function createMethodDecorator(httpMethod: HttpMethod, path: string) {
  return function <T extends (...args: any[]) => any>(
    target: T,
    context: ClassMethodDecoratorContext<any, T>
  ): T | void {
    if (context.private || context.static) {
      return;
    }

    const methodName = String(context.name);
    const bucket = getBucket(context.metadata);

    let op = bucket.ops.find(op => op.methodName === methodName);
    if (!op) {
      op = {
        httpMethod,
        path,
        methodName,
      };
      bucket.ops.push(op);
    } else {
      op.httpMethod = httpMethod;
      op.path = path;
    }
  };
}

/**
 * Creates a method decorator for HTTP GET requests.
 * @param path - The route path for this endpoint
 */
export const Get = (path: string) => createMethodDecorator("GET", path);

/**
 * Creates a method decorator for HTTP POST requests.
 * @param path - The route path for this endpoint
 */
export const Post = (path: string) => createMethodDecorator("POST", path);

/**
 * Creates a method decorator for HTTP PUT requests.
 * @param path - The route path for this endpoint
 */
export const Put = (path: string) => createMethodDecorator("PUT", path);

/**
 * Creates a method decorator for HTTP PATCH requests.
 * @param path - The route path for this endpoint
 */
export const Patch = (path: string) => createMethodDecorator("PATCH", path);

/**
 * Creates a method decorator for HTTP DELETE requests.
 * @param path - The route path for this endpoint
 */
export const Delete = (path: string) => createMethodDecorator("DELETE", path);
