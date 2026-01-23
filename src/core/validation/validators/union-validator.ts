import type { ValidationError } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";

/**
 * Validates a union value.
 */
export function validateUnion(
  value: unknown,
  schema: { kind: "union"; anyOf: SchemaNode[] },
  path: string
): ValidationError[] {
  // For union types, value must validate against at least one schema
  const validSchemas = schema.anyOf.filter(s => {
    const errors = validate(value, s, path);
    return errors.length === 0;
  });

  if (validSchemas.length === 0) {
    return [
      {
        field: path,
        message: "must match one of the allowed types",
        value
      }
    ];
  }

  return [];
}
