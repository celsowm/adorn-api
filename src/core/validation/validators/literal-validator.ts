import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import { createValidationError, deepEqual } from "./validation-utils";

/**
 * Validates a literal value.
 */
export function validateLiteral(
  value: unknown,
  schema: { kind: "literal"; value: any },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!deepEqual(schema.value, value)) {
    errors.push(createValidationError(
      path,
      `must be ${JSON.stringify(schema.value)}`,
      value,
      "LITERAL_INVALID_VALUE" as ValidationErrorCode
    ));
  }

  return errors;
}
