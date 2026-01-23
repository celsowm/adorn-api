import type { ValidationError } from "../../validation-errors";

/**
 * Validates a boolean value.
 */
export function validateBoolean(
  value: unknown,
  schema: { kind: "boolean" },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== "boolean") {
    errors.push({
      field: path,
      message: "must be a boolean",
      value
    });
  }

  return errors;
}
