import { HttpError } from "./errors";

/**
 * Enumeration of validation error codes for programmatic error handling.
 */
export enum ValidationErrorCode {
  // Type errors
  TYPE_STRING = "TYPE_STRING",
  TYPE_NUMBER = "TYPE_NUMBER",
  TYPE_INTEGER = "TYPE_INTEGER",
  TYPE_BOOLEAN = "TYPE_BOOLEAN",
  TYPE_ARRAY = "TYPE_ARRAY",
  TYPE_OBJECT = "TYPE_OBJECT",
  TYPE_NULL = "TYPE_NULL",
  TYPE_FINITE_NUMBER = "TYPE_FINITE_NUMBER",

  // String format errors
  FORMAT_UUID = "FORMAT_UUID",
  FORMAT_DATE_TIME = "FORMAT_DATE_TIME",
  FORMAT_EMAIL = "FORMAT_EMAIL",
  FORMAT_URI = "FORMAT_URI",
  FORMAT_HOSTNAME = "FORMAT_HOSTNAME",
  FORMAT_IPV4 = "FORMAT_IPV4",
  FORMAT_IPV6 = "FORMAT_IPV6",

  // String constraint errors
  STRING_MIN_LENGTH = "STRING_MIN_LENGTH",
  STRING_MAX_LENGTH = "STRING_MAX_LENGTH",
  STRING_PATTERN = "STRING_PATTERN",

  // Number constraint errors
  NUMBER_MINIMUM = "NUMBER_MINIMUM",
  NUMBER_MAXIMUM = "NUMBER_MAXIMUM",
  NUMBER_EXCLUSIVE_MINIMUM = "NUMBER_EXCLUSIVE_MINIMUM",
  NUMBER_EXCLUSIVE_MAXIMUM = "NUMBER_EXCLUSIVE_MAXIMUM",
  NUMBER_MULTIPLE_OF = "NUMBER_MULTIPLE_OF",

  // Array constraint errors
  ARRAY_MIN_ITEMS = "ARRAY_MIN_ITEMS",
  ARRAY_MAX_ITEMS = "ARRAY_MAX_ITEMS",
  ARRAY_UNIQUE_ITEMS = "ARRAY_UNIQUE_ITEMS",

  // Object constraint errors
  OBJECT_REQUIRED_PROPERTY = "OBJECT_REQUIRED_PROPERTY",
  OBJECT_ADDITIONAL_PROPERTY = "OBJECT_ADDITIONAL_PROPERTY",
  OBJECT_MIN_PROPERTIES = "OBJECT_MIN_PROPERTIES",
  OBJECT_MAX_PROPERTIES = "OBJECT_MAX_PROPERTIES",

  // Enum and literal errors
  ENUM_INVALID_VALUE = "ENUM_INVALID_VALUE",
  LITERAL_INVALID_VALUE = "LITERAL_INVALID_VALUE",

  // Union errors
  UNION_NO_MATCH = "UNION_NO_MATCH",

  // DTO errors
  DTO_MISSING_DECORATOR = "DTO_MISSING_DECORATOR",

  // Generic errors
  UNKNOWN = "UNKNOWN"
}

/**
 * Represents a single validation error for a field.
 */
export interface ValidationError {
  /** Field name or path that failed validation */
  field: string;
  /** Error message describing the validation failure */
  message: string;
  /** The value that caused the validation failure */
  value?: any;
  /** Machine-readable error code for programmatic handling */
  code?: ValidationErrorCode;
}

/**
 * Aggregate validation error containing multiple validation failures.
 */
export class ValidationErrors extends HttpError {
  /** Array of individual validation errors */
  errors: ValidationError[];

  /**
   * Creates a new ValidationErrors instance.
   * @param errors Array of validation errors
   * @param message Optional custom error message
   */
  constructor(errors: ValidationError[], message?: string) {
    super(400, message ?? "Validation failed", {
      message: "Validation failed",
      errors
    });
    this.name = "ValidationErrors";
    this.errors = errors;
  }
}

/**
 * Type guard for checking if a value is a ValidationErrors instance.
 * @param value Value to check
 * @returns True if the value is a ValidationErrors instance
 */
export function isValidationErrors(value: unknown): value is ValidationErrors {
  return (
    value instanceof Error &&
    value.name === "ValidationErrors" &&
    "errors" in value &&
    Array.isArray((value as any).errors)
  );
}
