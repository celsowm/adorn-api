import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";
import { createValidationError, validateIsObject, validateAdditionalProperties, validatePropertyCount } from "./validation-utils";

/**
 * Validates an object value.
 */
export function validateObject(
  value: unknown,
  schema: { kind: "object"; properties?: Record<string, SchemaNode>; required?: string[]; additionalProperties?: boolean | SchemaNode; minProperties?: number; maxProperties?: number },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate that value is an object
  errors.push(...validateIsObject(value, path));
  if (errors.length > 0) {
    return errors;
  }

  const objValue = value as Record<string, unknown>;

  // Validate properties
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const propValue = objValue[propName];
      const isRequired = schema.required?.includes(propName) ?? false;

      if (isRequired && propValue === undefined) {
        errors.push(createValidationError(propPath, "is required", propValue, "OBJECT_REQUIRED_PROPERTY" as ValidationErrorCode));
        continue;
      }

      if (propValue !== undefined && propValue !== null) {
        const propErrors = validate(propValue, propSchema, propPath);
        errors.push(...propErrors);
      }
    }
  }

  // Validate additional properties
  const allowedKeys = schema.properties ? Object.keys(schema.properties) : [];
  errors.push(...validateAdditionalProperties(objValue, allowedKeys, schema.additionalProperties, path));

  // Validate min/max properties
  errors.push(...validatePropertyCount(objValue, schema.minProperties, schema.maxProperties, path));

  return errors;
}
