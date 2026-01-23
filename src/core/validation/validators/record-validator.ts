import type { ValidationError } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";

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
    errors.push({
      field: path,
      message: "must be an object",
      value
    });
    return errors;
  }

  if (typeof value !== "object") {
    errors.push({
      field: path,
      message: "must be an object",
      value
    });
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
