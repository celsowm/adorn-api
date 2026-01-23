import type { DtoConstructor } from "../../types";
import { getDtoMeta } from "../../metadata";
import type { ValidationError } from "../../validation-errors";
import { validate } from "../validate";

/**
 * Validates a value against a DTO schema.
 * @param value Value to validate
 * @param dto DTO constructor
 * @param path Optional field path for error reporting
 * @returns Array of validation errors
 */
export function validateDto(
  value: unknown,
  dto: DtoConstructor,
  path: string
): ValidationError[] {
  const dtoMeta = getDtoMeta(dto);
  if (!dtoMeta) {
    throw new Error(`DTO "${dto.name}" is missing @Dto decorator.`);
  }

  const errors: ValidationError[] = [];

  // Check if value is an object
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

  // Validate each field
  for (const [fieldName, fieldMeta] of Object.entries(dtoMeta.fields)) {
    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
    const fieldValue = (value as any)[fieldName];
    const isOptional = fieldMeta.optional ?? fieldMeta.schema.optional ?? false;

    // Check required field
    if (!isOptional && fieldValue === undefined) {
      errors.push({
        field: fieldPath,
        message: "is required",
        value: fieldValue
      });
      continue;
    }

    // Validate field value if present
    if (fieldValue !== undefined && fieldValue !== null) {
      const fieldErrors = validate(
        fieldValue,
        fieldMeta.schema,
        fieldPath
      );
      errors.push(...fieldErrors);
    }
  }

  // Check additional properties
  if (!dtoMeta.additionalProperties) {
    const valueKeys = Object.keys(value as Record<string, unknown>);
    const dtoKeys = Object.keys(dtoMeta.fields);
    const additionalKeys = valueKeys.filter(key => !dtoKeys.includes(key));

    for (const key of additionalKeys) {
      errors.push({
        field: path ? `${path}.${key}` : key,
        message: "is not a valid field",
        value: (value as any)[key]
      });
    }
  }

  return errors;
}
