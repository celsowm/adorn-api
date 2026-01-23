import type { DtoConstructor } from "../../types";
import { getDtoMeta } from "../../metadata";
import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import { validate } from "../validate";
import { createValidationError, validateIsObject, validateAdditionalProperties } from "./validation-utils";

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

  // Validate that value is an object
  errors.push(...validateIsObject(value, path));
  if (errors.length > 0) {
    return errors;
  }

  const objValue = value as Record<string, unknown>;

  // Validate each field
  for (const [fieldName, fieldMeta] of Object.entries(dtoMeta.fields)) {
    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
    const fieldValue = objValue[fieldName];
    const isOptional = fieldMeta.optional ?? fieldMeta.schema.optional ?? false;

    // Check required field
    if (!isOptional && fieldValue === undefined) {
      errors.push(createValidationError(fieldPath, "is required", fieldValue, "OBJECT_REQUIRED_PROPERTY" as ValidationErrorCode));
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
  const allowedKeys = Object.keys(dtoMeta.fields);
  const additionalProperties = dtoMeta.additionalProperties ? undefined : false;
  errors.push(...validateAdditionalProperties(objValue, allowedKeys, additionalProperties, path));

  return errors;
}
