import type { ValidationError } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";

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
    errors.push({
      field: path,
      message: "must be an array",
      value
    });
    return errors;
  }

  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push({
      field: path,
      message: `must have at least ${schema.minItems} items`,
      value
    });
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push({
      field: path,
      message: `must have at most ${schema.maxItems} items`,
      value
    });
  }

  if (schema.uniqueItems && hasDuplicates(value)) {
    errors.push({
      field: path,
      message: "must contain unique items",
      value
    });
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

function hasDuplicates(arr: any[]): boolean {
  const seen = new Set();
  for (const item of arr) {
    const serialized = JSON.stringify(item);
    if (seen.has(serialized)) {
      return true;
    }
    seen.add(serialized);
  }
  return false;
}
