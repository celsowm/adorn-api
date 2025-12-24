/**
 * Validation adapter interface
 * 
 * This defines the contract for runtime validation adapters.
 * Adapters transform DTO classes into runtime validation schemas.
 */

export interface ValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: string[];
}

export interface ValidationAdapter {
  /**
   * Create a validation schema from a DTO class
   */
  createSchema<T extends object>(dtoClass: new () => T): ValidationSchema;
  
  /**
   * Validate data against a schema
   */
  validate(schema: ValidationSchema, data: unknown): ValidationResult;
}

/**
 * Represents a runtime validation schema
 */
export interface ValidationSchema {
  /**
   * Optional schema name for debugging/error messages
   */
  name?: string;
  
  /**
   * Internal representation (adapter-specific)
   */
  [key: symbol]: unknown;
}

/**
 * Adapter type symbol for identification
 */
export const ADAPTER_SYMBOL = Symbol('validation-adapter');
