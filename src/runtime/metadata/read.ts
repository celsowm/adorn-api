import { ADORN_META } from "./key.js";
import type { AdornBucket } from "./types.js";

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
