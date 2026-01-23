import type { ValidationError } from "../../validation-errors";

/**
 * Validates a number value.
 */
export function validateNumber(
  value: unknown,
  schema: { kind: "number" | "integer"; minimum?: number; maximum?: number; exclusiveMinimum?: number; exclusiveMaximum?: number; multipleOf?: number },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value !== "number") {
    errors.push({
      field: path,
      message: `must be a ${schema.kind}`,
      value
    });
    return errors;
  }

  if (schema.kind === "integer" && !Number.isInteger(value)) {
    errors.push({
      field: path,
      message: "must be an integer",
      value
    });
  }

  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push({
      field: path,
      message: `must be at least ${schema.minimum}`,
      value
    });
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push({
      field: path,
      message: `must be at most ${schema.maximum}`,
      value
    });
  }

  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    errors.push({
      field: path,
      message: `must be greater than ${schema.exclusiveMinimum}`,
      value
    });
  }

  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    errors.push({
      field: path,
      message: `must be less than ${schema.exclusiveMaximum}`,
      value
    });
  }

  if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
    errors.push({
      field: path,
      message: `must be a multiple of ${schema.multipleOf}`,
      value
    });
  }

  return errors;
}
