import { HttpError } from "./errors";

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
