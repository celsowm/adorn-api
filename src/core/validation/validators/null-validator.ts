import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import { createValidationError } from "./validation-utils";

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
    errors.push(createValidationError(path, "must be null", value, "TYPE_NULL" as ValidationErrorCode));
  }

  return errors;
}
