import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";
import { createValidationError } from "./validation-utils";

/**
 * Validates a record value.
 */
export function validateRecord(
  value: unknown,
  schema: { kind: "record"; values: SchemaNode },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push(createValidationError(path, "must be an object", value, "TYPE_OBJECT" as ValidationErrorCode));
    return errors;
  }

  if (typeof value !== "object") {
    errors.push(createValidationError(path, "must be an object", value, "TYPE_OBJECT" as ValidationErrorCode));
    return errors;
  }

  // Validate each value in the record
  for (const [key, recordValue] of Object.entries(value as Record<string, unknown>)) {
    const recordPath = path ? `${path}.${key}` : key;
    const recordErrors = validate(recordValue, schema.values, recordPath);
    errors.push(...recordErrors);
  }

  return errors;
}
