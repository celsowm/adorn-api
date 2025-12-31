import { getBucket } from "../runtime/metadata/bucket.js";
import type { HttpMethod } from "../runtime/metadata/types.js";

export function Public() {
  return function (
    target: any,
    context: ClassMethodDecoratorContext
  ) {
    if (context.kind !== "method") {
      throw new Error("@Public decorator can only be applied to methods");
    }

    const methodName = String(context.name);
    const bucket = getBucket(context.metadata);
    let op = bucket.ops.find(op => op.methodName === methodName);
    if (!op) {
      op = {
        httpMethod: "GET" as HttpMethod,
        path: "/",
        methodName,
      };
      bucket.ops.push(op);
    }

    op.auth = "public";
  };
}
