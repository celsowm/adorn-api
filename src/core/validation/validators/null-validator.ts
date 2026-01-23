import type { ValidationError } from "../../validation-errors";

/**
 * Validates a null value.
 */
export function validateNull(
  value: unknown,
  schema: { kind: "null" },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value !== null) {
    errors.push({
      field: path,
      message: "must be null",
      value
    });
  }

  return errors;
}
