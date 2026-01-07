import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";

/**
 * Runtime validation module using AJV.
 * 
 * @remarks
 * This module provides validation utilities using the AJV JSON schema validator.
 * It includes interfaces for validation results, errors, and helper functions
 * for creating validators and formatting error messages.
 * 
 * @package
 */

/**
 * Represents a single validation error with details.
 * 
 * @public
 */
export interface ValidationError {
  /**
   * The JSON path to the invalid property.
   */
  path: string;
  
  /**
   * Human-readable error message.
   */
  message: string;
  
  /**
   * The AJV keyword that failed validation.
   */
  keyword: string;
  
  /**
   * Additional parameters from the validation error.
   */
  params: Record<string, unknown>;
}

/**
 * Result of a validation operation.
 * 
 * @public
 */
export interface ValidationResult {
  /**
   * Whether the data passed validation.
   */
  valid: boolean;
  
  /**
   * Array of validation errors if validation failed, null otherwise.
   */
  errors: ValidationError[] | null;
}

/**
 * Error thrown when request validation fails.
 * 
 * @public
 */
export class ValidationErrorResponse extends Error {
  /**
   * HTTP status code for validation errors.
   */
  statusCode: number;
  
  /**
   * Detailed validation errors.
   */
  errors: ValidationError[];

  /**
   * Creates a new ValidationErrorResponse.
   * 
   * @param statusCode - HTTP status code (typically 400)
   * @param errors - Array of validation errors
   */
  constructor(statusCode: number, errors: ValidationError[]) {
    super("Validation failed");
    this.name = "ValidationErrorResponse";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/**
 * Creates a configured AJV validator instance.
 * 
 * @remarks
 * This function creates an AJV validator with adorn-api's default configuration,
 * including support for custom formats like "br-phone" for Brazilian phone numbers.
 * 
 * @returns A configured AJV validator instance
 * 
 * @example
 * ```typescript
 * const validator = createValidator();
 * const validate = validator.compile(mySchema);
 * const result = validate(myData);
 * ```
 * 
 * @public
 */
export function createValidator() {
  const ajv = new Ajv.default({
    allErrors: true,
    coerceTypes: false,
    strict: false,
    validateFormats: true,
  });

  addFormats.default(ajv);

  ajv.addFormat("br-phone", /^\(\d{2}\)\s\d{5}-\d{4}$/);

  return ajv;
}

/**
 * Validates data against a JSON schema.
 * 
 * @remarks
 * This function compiles the schema and validates the data, returning a
 * structured result with formatted error messages.
 * 
 * @param ajv - The AJV validator instance
 * @param data - The data to validate
 * @param schema - The JSON schema to validate against
 * @param dataPath - Base path for error messages (default: "#")
 * @returns ValidationResult with validity and any errors
 * 
 * @public
 */
export function validateData(
  ajv: ReturnType<typeof createValidator>,
  data: unknown,
  schema: Record<string, unknown>,
  dataPath: string = "#"
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: null };
  }

  const errors: ValidationError[] = (validate.errors || []).map((err: ErrorObject) => ({
    path: formatErrorPath(dataPath, err),
    message: err.message || "Invalid value",
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  }));

  return { valid: false, errors };
}

/**
 * Formats an error path for display.
 * 
 * @internal
 */
function formatErrorPath(basePath: string, err: ErrorObject): string {
  const instancePath = err.instancePath;

  if (!instancePath || instancePath === "") {
    return basePath;
  }

  if (basePath === "#" || basePath.endsWith("/")) {
    return `${basePath}${instancePath.slice(1)}`;
  }

  return `${basePath}${instancePath}`;
}

/**
 * Formats validation errors into a structured API response.
 * 
 * @remarks
 * This function converts validation errors into a format suitable for API
 * responses, grouping errors by their path.
 * 
 * @param errors - Array of validation errors
 * @returns Formatted error response object
 * 
 * @public
 */
export function formatValidationErrors(errors: ValidationError[]): Record<string, unknown> {
  const formatted: Record<string, string[]> = {};

  for (const error of errors) {
    const path = error.path || "body";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  }

  return {
    error: "Validation failed",
    details: formatted,
  };
}
