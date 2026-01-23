import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import { createValidationError, isFiniteNumber, isMultipleOf } from "./validation-utils";

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
    errors.push(createValidationError(path, `must be a ${schema.kind}`, value, schema.kind === "integer" ? "TYPE_INTEGER" as ValidationErrorCode : "TYPE_NUMBER" as ValidationErrorCode));
    return errors;
  }

  // Check for NaN and Infinity
  if (!isFiniteNumber(value)) {
    errors.push(createValidationError(path, `must be a finite ${schema.kind}`, value, "TYPE_FINITE_NUMBER" as ValidationErrorCode));
    return errors;
  }

  if (schema.kind === "integer" && !Number.isInteger(value)) {
    errors.push(createValidationError(path, "must be an integer", value, "TYPE_INTEGER" as ValidationErrorCode));
  }

  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push(createValidationError(path, `must be at least ${schema.minimum}`, value, "NUMBER_MINIMUM" as ValidationErrorCode));
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push(createValidationError(path, `must be at most ${schema.maximum}`, value, "NUMBER_MAXIMUM" as ValidationErrorCode));
  }

  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    errors.push(createValidationError(path, `must be greater than ${schema.exclusiveMinimum}`, value, "NUMBER_EXCLUSIVE_MINIMUM" as ValidationErrorCode));
  }

  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    errors.push(createValidationError(path, `must be less than ${schema.exclusiveMaximum}`, value, "NUMBER_EXCLUSIVE_MAXIMUM" as ValidationErrorCode));
  }

  if (schema.multipleOf !== undefined && !isMultipleOf(value, schema.multipleOf)) {
    errors.push(createValidationError(path, `must be a multiple of ${schema.multipleOf}`, value, "NUMBER_MULTIPLE_OF" as ValidationErrorCode));
  }

  return errors;
}
