import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import { createValidationError } from "./validation-utils";

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
    errors.push(createValidationError(path, "must be a boolean", value, "TYPE_BOOLEAN" as ValidationErrorCode));
  }

  return errors;
}
