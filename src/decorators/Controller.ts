import { getBucket } from "../runtime/metadata/bucket.js";

export function Controller(basePath: string) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    context: ClassDecoratorContext<T>
  ): T | void {
    const bucket = getBucket(context.metadata);
    bucket.basePath = basePath;
  };
}
