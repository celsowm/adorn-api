import { getBucket } from "../runtime/metadata/bucket.js";

export interface PaginatedOptions {
  defaultPageSize?: number;
}

export function Paginated(options: PaginatedOptions = {}) {
  return function (
    _target: any,
    context: ClassMethodDecoratorContext
  ) {
    if (context.kind !== "method") {
      throw new Error("@Paginated decorator can only be applied to methods");
    }

    const methodName = String(context.name);
    const bucket = getBucket(context.metadata);
    let op = bucket.ops.find(op => op.methodName === methodName);
    if (!op) {
      op = {
        httpMethod: "GET",
        path: "/",
        methodName,
      };
      bucket.ops.push(op);
    }

    op.pagination = {
      defaultPageSize: options.defaultPageSize ?? 10,
    };
  };
}
