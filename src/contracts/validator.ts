/**
 * Path to a validation issue within the request data.
 *
 * Represents the location of a validation failure using an array
 * where each element is a property name or array index.
 *
 * @example
 * ```typescript
 * // For body: { user: { email: 'invalid' } }
 * const path: ValidationPath = ['body', 'user', 'email'];
 *
 * // For query: { filters: { page: 'not-a-number' } }
 * const path: ValidationPath = ['query', 'filters', 'page'];
 *
 * // For array: { items: [{ id: 'invalid' }] }
 * const path: ValidationPath = ['body', 'items', 0, 'id'];
 * ```
 */
export type ValidationPath = Array<string | number>;

/**
 * Individual validation issue with path and details.
 *
 * Represents a single validation failure with information about
 * where it occurred, what was expected, and what was received.
 */
export type ValidationIssue = {
  /** Path to the invalid data within the request */
  path: ValidationPath; // e.g. ["body", "email"] or ["query", "page"]
  /** Human-readable error message */
  message: string; // human readable
  /** Machine-readable error code */
  code?: string; // e.g. "invalid_type", "too_small"
  /** Expected value or type */
  expected?: unknown;
  /** Received value that failed validation */
  received?: unknown;
};

/**
 * Result of a validation operation.
 *
 * This discriminated union represents either a successful validation
 * with the validated value, or a failed validation with issues.
 *
 * @template T - The expected type after successful validation
 *
 * @example
 * ```typescript
 * // Successful validation
 * const success: ValidationResult<User> = {
 *   ok: true,
 *   value: { id: '123', name: 'John Doe', email: 'john@example.com' }
 * };
 *
 * // Failed validation
 * const failure: ValidationResult<User> = {
 *   ok: false,
 *   issues: [
 *     { path: ['body', 'email'], message: 'Invalid email format', code: 'invalid_string' }
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Usage in validation logic
 * const result = validator.validateBody(request.body, 'createUserSchema');
 *
 * if (!result.ok) {
 *   throw new ValidationError('Invalid user data', result.issues);
 * }
 *
 * const validatedUser = result.value;
 * ```
 */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Optional pluggable validator interface.
 *
 * You can implement adapters later (zod/ajv/valibot).
 *
 * This interface defines the contract for validation services
 * that can be plugged into the Adorn API framework.
 *
 * @example
 * ```typescript
 * // Custom validator implementation
 * class MyValidator implements Validator {
 *   validateBody<T>(body: unknown, schemaId: string): ValidationResult<T> {
 *     // Implement body validation logic
 *   }
 *
 *   validateQuery<T>(query: unknown, schemaId: string): ValidationResult<T> {
 *     // Implement query validation logic
 *   }
 *
 *   validateParams<T>(params: unknown, schemaId: string): ValidationResult<T> {
 *     // Implement params validation logic
 *   }
 * }
 *
 * // Usage in Express adapter
 * const app = createAdornExpressApp({
 *   controllers: [UserController],
 *   validator: new MyValidator()
 * });
 * ```
 *
 * @see ValidationResult for the result type
 * @see ValidationIssue for issue details
 */
export interface Validator {
  /**
   * Validates request body against a schema.
   *
   * @template T - Expected type after validation
   * @param body - Request body to validate
   * @param schemaId - Identifier for the schema to use
   * @returns Validation result
   */
  validateBody<T = unknown>(body: unknown, schemaId: string): ValidationResult<T>;
  
  /**
   * Validates query parameters against a schema.
   *
   * @template T - Expected type after validation
   * @param query - Query parameters to validate
   * @param schemaId - Identifier for the schema to use
   * @returns Validation result
   */
  validateQuery<T = unknown>(query: unknown, schemaId: string): ValidationResult<T>;
  
  /**
   * Validates path parameters against a schema.
   *
   * @template T - Expected type after validation
   * @param params - Path parameters to validate
   * @param schemaId - Identifier for the schema to use
   * @returns Validation result
   */
  validateParams<T = unknown>(params: unknown, schemaId: string): ValidationResult<T>;
}
