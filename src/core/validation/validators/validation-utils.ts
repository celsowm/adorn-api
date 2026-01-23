import type { ValidationError, ValidationErrorCode } from "../../validation-errors";
import type { SchemaNode } from "../../schema";
import { validate } from "../validate";

/**
 * Creates a validation error object.
 * @param field - Field path where the error occurred
 * @param message - Error message
 * @param value - The value that failed validation
 * @param code - Optional error code for programmatic handling
 * @returns ValidationError object
 */
export function createValidationError(
  field: string,
  message: string,
  value: unknown,
  code?: ValidationErrorCode
): ValidationError {
  return { field, message, value, code };
}

/**
 * Validates that a value is a plain object (not null, not array).
 * @param value - Value to check
 * @param path - Field path for error reporting
 * @returns Array of validation errors (empty if valid)
 */
export function validateIsObject(
  value: unknown,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push(createValidationError(path, "must be an object", value, "TYPE_OBJECT" as ValidationErrorCode));
    return errors;
  }

  if (typeof value !== "object") {
    errors.push(createValidationError(path, "must be an object", value, "TYPE_OBJECT" as ValidationErrorCode));
    return errors;
  }

  return errors;
}

/**
 * Validates additional properties on an object.
 * @param value - Object to validate
 * @param allowedKeys - Keys that are allowed
 * @param additionalPropertiesSchema - Optional schema for additional properties
 * @param path - Field path for error reporting
 * @returns Array of validation errors
 */
export function validateAdditionalProperties(
  value: Record<string, unknown>,
  allowedKeys: string[],
  additionalPropertiesSchema: boolean | SchemaNode | undefined,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const valueKeys = Object.keys(value);
  const additionalKeys = valueKeys.filter(key => !allowedKeys.includes(key));

  if (additionalPropertiesSchema === false) {
    // Reject all additional properties
    for (const key of additionalKeys) {
      errors.push(createValidationError(
        path ? `${path}.${key}` : key,
        "is not a valid field",
        value[key],
        "OBJECT_ADDITIONAL_PROPERTY" as ValidationErrorCode
      ));
    }
  } else if (typeof additionalPropertiesSchema === "object") {
    // Validate additional properties against schema
    for (const key of additionalKeys) {
      const additionalPath = path ? `${path}.${key}` : key;
      const additionalErrors = validate(
        value[key],
        additionalPropertiesSchema,
        additionalPath
      );
      errors.push(...additionalErrors);
    }
  }

  return errors;
}

/**
 * Validates min/max properties constraints on an object.
 * @param value - Object to validate
 * @param minProperties - Minimum number of properties
 * @param maxProperties - Maximum number of properties
 * @param path - Field path for error reporting
 * @returns Array of validation errors
 */
export function validatePropertyCount(
  value: Record<string, unknown>,
  minProperties: number | undefined,
  maxProperties: number | undefined,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const propertyCount = Object.keys(value).length;

  if (minProperties !== undefined && propertyCount < minProperties) {
    errors.push(createValidationError(
      path,
      `must have at least ${minProperties} properties`,
      value,
      "OBJECT_MIN_PROPERTIES" as ValidationErrorCode
    ));
  }

  if (maxProperties !== undefined && propertyCount > maxProperties) {
    errors.push(createValidationError(
      path,
      `must have at most ${maxProperties} properties`,
      value,
      "OBJECT_MAX_PROPERTIES" as ValidationErrorCode
    ));
  }

  return errors;
}

/**
 * Deep equality check for validation.
 * Handles primitives, arrays, and nested objects.
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns True if values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Strict equality for primitives and same reference
  if (a === b) return true;

  // Handle NaN (NaN !== NaN, but should be considered equal)
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
  }

  // Different types cannot be equal
  if (typeof a !== typeof b) return false;

  // Handle null (typeof null === "object")
  if (a === null || b === null) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Serializes a value for comparison (used in unique items validation).
 * Uses JSON.stringify for simplicity, but could be enhanced for better performance.
 * @param value - Value to serialize
 * @returns String representation of the value
 */
export function serializeValue(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Checks if a value is a finite number (not NaN or Infinity).
 * @param value - Value to check
 * @returns True if value is a finite number
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Checks if a value is a valid integer (finite and no decimal part).
 * @param value - Value to check
 * @returns True if value is a valid integer
 */
export function isValidInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

/**
 * Checks if a value is a plain object (not null, not array, not a function).
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Checks if a value is a valid date string (ISO 8601 format).
 * @param value - Value to check
 * @returns True if value is a valid date string
 */
export function isValidDateString(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Checks if a value is a valid UUID (v1-v5).
 * @param value - Value to check
 * @returns True if value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

/**
 * Checks if a value is a valid email address.
 * @param value - Value to check
 * @returns True if value is a valid email
 */
export function isValidEmail(value: string): boolean {
  // RFC 5322 compliant email regex (simplified)
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailPattern.test(value);
}

/**
 * Checks if a value is a valid URI.
 * @param value - Value to check
 * @returns True if value is a valid URI
 */
export function isValidURI(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a value is a valid hostname.
 * @param value - Value to check
 * @returns True if value is a valid hostname
 */
export function isValidHostname(value: string): boolean {
  // RFC 1123 hostname pattern
  const hostnamePattern = /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]))*$/;
  return hostnamePattern.test(value) && value.length <= 253;
}

/**
 * Checks if a value is a valid IPv4 address.
 * @param value - Value to check
 * @returns True if value is a valid IPv4 address
 */
export function isValidIPv4(value: string): boolean {
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Pattern.test(value);
}

/**
 * Checks if a value is a valid IPv6 address.
 * @param value - Value to check
 * @returns True if value is a valid IPv6 address
 */
export function isValidIPv6(value: string): boolean {
  // Simplified IPv6 pattern
  const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;
  return ipv6Pattern.test(value);
}

/**
 * Checks if a number is a multiple of another number with floating-point precision handling.
 * @param value - Value to check
 * @param divisor - Divisor to check against
 * @returns True if value is a multiple of divisor
 */
export function isMultipleOf(value: number, divisor: number): boolean {
  if (divisor === 0) return false;
  
  // Handle floating-point precision issues
  const quotient = value / divisor;
  const roundedQuotient = Math.round(quotient);
  const difference = Math.abs(quotient - roundedQuotient);
  
  // Use a small epsilon for floating-point comparison
  const epsilon = 1e-10;
  return difference < epsilon;
}

/**
 * Cache for compiled regular expressions to avoid recompilation.
 */
const regexCache = new Map<string, RegExp>();

/**
 * Gets or creates a cached RegExp for the given pattern.
 * @param pattern - Regular expression pattern string
 * @param flags - RegExp flags
 * @returns Compiled RegExp object
 */
export function getCachedRegex(pattern: string, flags: string = ""): RegExp {
  const cacheKey = `${pattern}|${flags}`;
  
  if (!regexCache.has(cacheKey)) {
    try {
      regexCache.set(cacheKey, new RegExp(pattern, flags));
    } catch {
      throw new Error(`Invalid regular expression pattern: ${pattern}`);
    }
  }
  
  return regexCache.get(cacheKey)!;
}

/**
 * Clears the regex cache (useful for testing or memory management).
 */
export function clearRegexCache(): void {
  regexCache.clear();
}