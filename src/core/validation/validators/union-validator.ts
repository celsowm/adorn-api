import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";
import { createValidationError } from "./validation-utils";

/**
 * Validates a union value.
 * The value must match at least one of the schemas in the union.
 */
export function validateUnion(
  value: unknown,
  schema: { kind: "union"; anyOf: SchemaNode[] },
  path: string
): ValidationError[] {
  // For union types, value must validate against at least one schema
  const validSchemas = schema.anyOf.filter(s => {
    const errors = validate(value, s, path);
    return errors.length === 0;
  });

  if (validSchemas.length > 0) {
    return [];
  }

  // Collect all errors from each schema to provide detailed feedback
  const allErrors: ValidationError[] = [];
  const schemaErrors: string[] = [];

  for (let i = 0; i < schema.anyOf.length; i++) {
    const errors = validate(value, schema.anyOf[i], path);
    if (errors.length > 0) {
      schemaErrors.push(`Schema ${i + 1}: ${errors[0].message}`);
      allErrors.push(...errors);
    }
  }

  // Return a summary error with details about why each schema failed
  const errorMessage = schemaErrors.length > 0
    ? `must match one of the allowed types. ${schemaErrors.join("; ")}`
    : "must match one of the allowed types";

  return [createValidationError(path, errorMessage, value, "UNION_NO_MATCH" as ValidationErrorCode)];
}
