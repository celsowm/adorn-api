import type { ValidationError } from "../../validation-errors";

/**
 * Validates a string value.
 */
export function validateString(
  value: unknown,
  schema: { kind: "string"; minLength?: number; maxLength?: number; pattern?: string; format?: string },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== "string") {
    errors.push({
      field: path,
      message: "must be a string",
      value
    });
    return errors;
  }

  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      field: path,
      message: `must be at least ${schema.minLength} characters long`,
      value
    });
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push({
      field: path,
      message: `must be at most ${schema.maxLength} characters long`,
      value
    });
  }

  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    errors.push({
      field: path,
      message: `must match pattern ${schema.pattern}`,
      value
    });
  }

  if (schema.format) {
    const formatErrors = validateFormat(value, schema.format, path);
    errors.push(...formatErrors);
  }

  return errors;
}

/**
 * Validates string format.
 */
function validateFormat(
  value: string,
  format: string,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (format) {
    case "uuid":
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(value)) {
        errors.push({
          field: path,
          message: "must be a valid UUID",
          value
        });
      }
      break;
    case "date-time":
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors.push({
          field: path,
          message: "must be a valid date-time",
          value
        });
      }
      break;
  }

  return errors;
}
