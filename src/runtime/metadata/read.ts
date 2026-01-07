import { ADORN_META } from "./key.js";
import type { AdornBucket } from "./types.js";

/**
 * Reads the AdornBucket metadata from a class constructor.
 * 
 * @remarks
 * This function retrieves the AdornBucket stored on a class via the
 * Symbol.metadata mechanism. It safely handles cases where metadata
 * is not available (e.g., polyfill not loaded or class not decorated).
 * 
 * @param ctor - The class constructor to read metadata from
 * @returns The AdornBucket if found, or null if not available
 * 
 * @example
 * ```typescript
 * @Controller()
 * class MyController { }
 * 
 * const bucket = readAdornBucket(MyController);
 * if (bucket) {
 *   console.log(bucket.ops);
 * }
 * ```
 * 
 * @internal
 */
export function readAdornBucket(ctor: Function): AdornBucket | null {
  const metaSym = (Symbol as any).metadata as symbol | undefined;
  if (!metaSym) {
    return null;
  }

  const classMetadata = (ctor as any)[metaSym] as DecoratorMetadata | undefined;
  if (!classMetadata) {
    return null;
  }

  const bucket = classMetadata[ADORN_META] as AdornBucket | undefined;
  return bucket ?? null;
}
