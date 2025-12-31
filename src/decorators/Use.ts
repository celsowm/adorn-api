import { getBucket } from "../runtime/metadata/bucket.js";
import type { ExpressMw, HttpMethod } from "../runtime/metadata/types.js";

type UseTarget = string | ExpressMw;

export function Use(...middleware: UseTarget[]) {
  return function (
    target: any,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ) {
    if (context.kind === "class") {
      const bucket = getBucket(context.metadata);
      if (!bucket.controllerUse) {
        bucket.controllerUse = [];
      }
      bucket.controllerUse.push(...middleware);
    } else if (context.kind === "method") {
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
      if (!op.use) {
        op.use = [];
      }
      op.use.push(...middleware);
    } else {
      throw new Error("@Use decorator can only be applied to classes or methods");
    }
  };
}
