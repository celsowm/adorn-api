import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import { createValidationError, deepEqual } from "./validation-utils";

/**
 * Validates an enum value.
 */
export function validateEnum(
  value: unknown,
  schema: { kind: "enum"; values: any[] },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema.values.some(v => deepEqual(v, value))) {
    errors.push(createValidationError(
      path,
      `must be one of: ${schema.values.map(v => JSON.stringify(v)).join(", ")}`,
      value,
      "ENUM_INVALID_VALUE" as ValidationErrorCode
    ));
  }

  return errors;
}
