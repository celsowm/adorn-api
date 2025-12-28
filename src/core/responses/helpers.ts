import type { Schema } from '../../validation/native/schema';

export function header<S extends Schema<any>>(
  schema: S,
  opts?: { required?: boolean; description?: string },
): { schema: S; required?: boolean; description?: string } {
  return {
    schema,
    required: opts?.required,
    description: opts?.description,
  };
}
