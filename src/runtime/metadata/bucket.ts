import { ADORN_META } from "./key.js";
import type { AdornBucket } from "./types.js";

/**
 * Retrieves the AdornBucket from decorator metadata, creating it if necessary.
 * 
 * @remarks
 * This function safely accesses the AdornBucket stored in decorator metadata.
 * If the bucket doesn't exist, it creates a new one with default values.
 * The bucket is stored under the ADORN_META symbol key.
 * 
 * @param metadata - The decorator context metadata object
 * @returns The AdornBucket for the decorated class
 * @throws Error if metadata is undefined (polyfill not loaded)
 * 
 * @internal
 */
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
