import type { ValidationError } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";

/**
 * Validates an object value.
 */
export function validateObject(
  value: unknown,
  schema: { kind: "object"; properties?: Record<string, SchemaNode>; required?: string[]; additionalProperties?: boolean | SchemaNode; minProperties?: number; maxProperties?: number },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

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

  if (schema.properties) {
    // Validate properties
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${propName}` : propName;
      const propValue = (value as any)[propName];
      const isRequired = schema.required?.includes(propName) ?? false;

      if (isRequired && propValue === undefined) {
        errors.push({
          field: propPath,
          message: "is required",
          value: propValue
        });
        continue;
      }

      if (propValue !== undefined && propValue !== null) {
        const propErrors = validate(propValue, propSchema, propPath);
        errors.push(...propErrors);
      }
    }
  }

  // Validate additional properties
  if (schema.additionalProperties === false) {
    const valueKeys = Object.keys(value as Record<string, unknown>);
    const schemaKeys = schema.properties ? Object.keys(schema.properties) : [];
    const additionalKeys = valueKeys.filter(key => !schemaKeys.includes(key));

    for (const key of additionalKeys) {
      errors.push({
        field: path ? `${path}.${key}` : key,
        message: "is not a valid field",
        value: (value as any)[key]
      });
    }
  } else if (typeof schema.additionalProperties === "object") {
    const valueKeys = Object.keys(value as Record<string, unknown>);
    const schemaKeys = schema.properties ? Object.keys(schema.properties) : [];
    const additionalKeys = valueKeys.filter(key => !schemaKeys.includes(key));

    for (const key of additionalKeys) {
      const additionalPath = path ? `${path}.${key}` : key;
      const additionalValue = (value as any)[key];
      const additionalErrors = validate(
        additionalValue,
        schema.additionalProperties!,
        additionalPath
      );
      errors.push(...additionalErrors);
    }
  }

  if (schema.minProperties !== undefined && Object.keys(value as Record<string, unknown>).length < schema.minProperties) {
    errors.push({
      field: path,
      message: `must have at least ${schema.minProperties} properties`,
      value
    });
  }

  if (schema.maxProperties !== undefined && Object.keys(value as Record<string, unknown>).length > schema.maxProperties) {
    errors.push({
      field: path,
      message: `must have at most ${schema.maxProperties} properties`,
      value
    });
  }

  return errors;
}
