import type { SchemaNode, SchemaSource } from "../schema";
import { ValidationError } from "../validation-errors";
import { validateDto } from "./validators/dto-validator";
import { validateString } from "./validators/string-validator";
import { validateNumber } from "./validators/number-validator";
import { validateBoolean } from "./validators/boolean-validator";
import { validateArray } from "./validators/array-validator";
import { validateObject } from "./validators/object-validator";
import { validateEnum } from "./validators/enum-validator";
import { validateLiteral } from "./validators/literal-validator";
import { validateUnion } from "./validators/union-validator";
import { validateRecord } from "./validators/record-validator";
import { validateNull } from "./validators/null-validator";

/**
 * Validates a value against a schema source.
 * @param value Value to validate
 * @param schema Schema source (schema node or DTO constructor)
 * @param path Optional field path for error reporting
 * @returns Array of validation errors
 */
export function validate(
  value: unknown,
  schema: SchemaSource,
  path: string = ""
): ValidationError[] {
  if (typeof schema === "function") {
    return validateDto(value, schema, path);
  }
  return validateSchemaNode(value, schema, path);
}

/**
 * Validates a value against a schema node.
 * @param value Value to validate
 * @param schema Schema node to validate against
 * @param path Optional field path for error reporting
 * @returns Array of validation errors
 */
function validateSchemaNode(
  value: unknown,
  schema: SchemaNode,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Handle optional fields
  if (schema.optional && value === undefined) {
    return errors;
  }

  // Handle nullable fields
  if (schema.nullable && value === null) {
    return errors;
  }

  // Validate based on schema kind
  switch (schema.kind) {
    case "string":
      errors.push(...validateString(value, schema, path));
      break;
    case "number":
    case "integer":
      errors.push(...validateNumber(value, schema, path));
      break;
    case "boolean":
      errors.push(...validateBoolean(value, schema, path));
      break;
    case "array":
      errors.push(...validateArray(value, schema, path));
      break;
    case "object":
      errors.push(...validateObject(value, schema, path));
      break;
    case "enum":
      errors.push(...validateEnum(value, schema, path));
      break;
    case "literal":
      errors.push(...validateLiteral(value, schema, path));
      break;
    case "union":
      errors.push(...validateUnion(value, schema, path));
      break;
    case "record":
      errors.push(...validateRecord(value, schema, path));
      break;
    case "ref":
      errors.push(...validate(value, schema.dto, path));
      break;
    case "any":
      // Any type accepts all values
      break;
    case "null":
      errors.push(...validateNull(value, schema, path));
      break;
    case "file":
      // File validation is handled separately
      break;
    default:
      break;
  }

  return errors;
}
