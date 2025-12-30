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

    bucket.ops.push({
      httpMethod,
      path,
      methodName,
    });
  };
}

export const Get = (path: string) => createMethodDecorator("GET", path);
export const Post = (path: string) => createMethodDecorator("POST", path);
export const Put = (path: string) => createMethodDecorator("PUT", path);
export const Patch = (path: string) => createMethodDecorator("PATCH", path);
export const Delete = (path: string) => createMethodDecorator("DELETE", path);
