import type { ValidationError } from "../../validation-errors";

/**
 * Validates a literal value.
 */
export function validateLiteral(
  value: unknown,
  schema: { kind: "literal"; value: any },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isEqual(schema.value, value)) {
    errors.push({
      field: path,
      message: `must be ${JSON.stringify(schema.value)}`,
      value
    });
  }

  return errors;
}

/**
 * Deep equality check for validation.
 */
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    if (a === null || b === null) return false;

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!isEqual(a[key], b[key])) return false;
    }

    return true;
  }

  return false;
}
