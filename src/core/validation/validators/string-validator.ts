import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import {
  createValidationError,
  getCachedRegex,
  isValidDateString,
  isValidDateOnlyString,
  isValidUUID,
  isValidEmail,
  isValidURI,
  isValidHostname,
  isValidIPv4,
  isValidIPv6
} from "./validation-utils";

/**
 * Validates a string value.
 */
export function validateString(
  value: unknown,
  schema: { kind: "string"; minLength?: number; maxLength?: number; pattern?: string; format?: string },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value instanceof Date) {
    if (schema.format === "date" || schema.format === "date-time") {
      if (Number.isNaN(value.getTime())) {
        const message = schema.format === "date"
          ? "must be a valid date"
          : "must be a valid date-time";
        errors.push(createValidationError(
          path,
          message,
          value,
          (schema.format === "date"
            ? "FORMAT_DATE"
            : "FORMAT_DATE_TIME") as ValidationErrorCode
        ));
      }
      return errors;
    }
    errors.push(createValidationError(path, "must be a string", value, "TYPE_STRING" as ValidationErrorCode));
    return errors;
  }

  if (typeof value !== "string") {
    errors.push(createValidationError(path, "must be a string", value, "TYPE_STRING" as ValidationErrorCode));
    return errors;
  }

  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(createValidationError(path, `must be at least ${schema.minLength} characters long`, value, "STRING_MIN_LENGTH" as ValidationErrorCode));
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push(createValidationError(path, `must be at most ${schema.maxLength} characters long`, value, "STRING_MAX_LENGTH" as ValidationErrorCode));
  }

  if (schema.pattern) {
    const regex = getCachedRegex(schema.pattern);
    if (!regex.test(value)) {
      errors.push(createValidationError(path, `must match pattern ${schema.pattern}`, value, "STRING_PATTERN" as ValidationErrorCode));
    }
  }

  if (schema.format) {
    const formatErrors = validateFormat(value, schema.format, path);
    errors.push(...formatErrors);
  }

  return errors;
}

/**
 * Validates string format.
 */
function validateFormat(
  value: string,
  format: string,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (format) {
    case "uuid":
      if (!isValidUUID(value)) {
        errors.push(createValidationError(path, "must be a valid UUID", value, "FORMAT_UUID" as ValidationErrorCode));
      }
      break;
    case "date-time":
      if (!isValidDateString(value)) {
        errors.push(createValidationError(path, "must be a valid date-time", value, "FORMAT_DATE_TIME" as ValidationErrorCode));
      }
      break;
    case "date":
      if (!isValidDateOnlyString(value)) {
        errors.push(createValidationError(path, "must be a valid date", value, "FORMAT_DATE" as ValidationErrorCode));
      }
      break;
    case "email":
      if (!isValidEmail(value)) {
        errors.push(createValidationError(path, "must be a valid email address", value, "FORMAT_EMAIL" as ValidationErrorCode));
      }
      break;
    case "uri":
      if (!isValidURI(value)) {
        errors.push(createValidationError(path, "must be a valid URI", value, "FORMAT_URI" as ValidationErrorCode));
      }
      break;
    case "hostname":
      if (!isValidHostname(value)) {
        errors.push(createValidationError(path, "must be a valid hostname", value, "FORMAT_HOSTNAME" as ValidationErrorCode));
      }
      break;
    case "ipv4":
      if (!isValidIPv4(value)) {
        errors.push(createValidationError(path, "must be a valid IPv4 address", value, "FORMAT_IPV4" as ValidationErrorCode));
      }
      break;
    case "ipv6":
      if (!isValidIPv6(value)) {
        errors.push(createValidationError(path, "must be a valid IPv6 address", value, "FORMAT_IPV6" as ValidationErrorCode));
      }
      break;
    default:
      // Unknown format - skip validation
      break;
  }

  return errors;
}
