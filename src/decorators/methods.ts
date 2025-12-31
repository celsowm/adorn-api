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

export const Get = (path: string) => createMethodDecorator("GET", path);
export const Post = (path: string) => createMethodDecorator("POST", path);
export const Put = (path: string) => createMethodDecorator("PUT", path);
export const Patch = (path: string) => createMethodDecorator("PATCH", path);
export const Delete = (path: string) => createMethodDecorator("DELETE", path);
