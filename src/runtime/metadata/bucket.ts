import { ADORN_META } from "./key.js";
import type { AdornBucket } from "./types.js";

export function getBucket(metadata: DecoratorMetadata): AdornBucket {
  if (!metadata) {
    throw new Error("Decorator context.metadata is undefined. Ensure Symbol.metadata polyfill runs before decorators.");
  }
  let bucket = metadata[ADORN_META] as AdornBucket | undefined;
  if (!bucket) {
    bucket = { ops: [], controllerUse: [] };
    metadata[ADORN_META] = bucket;
  }
  if (!bucket.controllerUse) {
    bucket.controllerUse = [];
  }
  return bucket;
}
