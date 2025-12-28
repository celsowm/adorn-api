import type { Schema } from '../../validation/native/schema.js';

export function header<S extends Schema<any>>(
  schema: S,
  opts?: { required?: boolean; description?: string },
): { schema: S; required?: boolean; description?: string } {
  return {
    schema,
    ...(opts?.required !== undefined ? { required: opts.required } : {}),
    ...(opts?.description !== undefined ? { description: opts.description } : {}),
  };
}
