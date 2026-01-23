import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";
import { createValidationError, deepEqual } from "./validation-utils";

/**
 * Validates an array value.
 */
export function validateArray(
  value: unknown,
  schema: { kind: "array"; items: SchemaNode; minItems?: number; maxItems?: number; uniqueItems?: boolean },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(value)) {
    errors.push(createValidationError(path, "must be an array", value, "TYPE_ARRAY" as ValidationErrorCode));
    return errors;
  }

  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push(createValidationError(path, `must have at least ${schema.minItems} items`, value, "ARRAY_MIN_ITEMS" as ValidationErrorCode));
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push(createValidationError(path, `must have at most ${schema.maxItems} items`, value, "ARRAY_MAX_ITEMS" as ValidationErrorCode));
  }

  if (schema.uniqueItems && hasDuplicates(value)) {
    errors.push(createValidationError(path, "must contain unique items", value, "ARRAY_UNIQUE_ITEMS" as ValidationErrorCode));
  }

  // Validate each item
  for (let i = 0; i < value.length; i++) {
    const itemErrors = validate(
      value[i],
      schema.items,
      `${path}[${i}]`
    );
    errors.push(...itemErrors);
  }

  return errors;
}

/**
 * Checks if an array contains duplicate items using deep equality.
 * @param arr - Array to check
 * @returns True if array contains duplicates
 */
function hasDuplicates(arr: unknown[]): boolean {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (deepEqual(arr[i], arr[j])) {
        return true;
      }
    }
  }
  return false;
}
