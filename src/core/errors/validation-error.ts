import { HttpError } from './http-error.js';
import type { ValidationIssue } from '../../contracts/validator.js';

/**
 * Validation Error class for representing validation failures.
 *
 * This class extends HttpError and is specifically used for validation errors.
 * It includes an array of validation issues that provide detailed information
 * about what validation failed and where.
 *
 * @example
 * ```typescript
 * // Manual creation
 * const error = new ValidationError('Invalid user data', [
 *   { path: ['body', 'email'], message: 'Email is required' },
 *   { path: ['body', 'password'], message: 'Password must be at least 8 characters' }
 * ]);
 *
 * throw error;
 * ```
 *
 * @example
 * ```typescript
 * // Using the convenience method
 * const issues = [
 *   { path: ['query', 'limit'], message: 'Limit must be a number' },
 *   { path: ['query', 'offset'], message: 'Offset must be a positive integer' }
 * ];
 *
 * throw ValidationError.fromIssues(issues, 'Invalid query parameters');
 * ```
 *
 * @example
 * ```typescript
 * // In a controller with validation
 * @Post('/users')
 * async createUser(userData: CreateUserDto) {
 *   const validationResult = await validator.validate(userData);
 *
 *   if (!validationResult.valid) {
 *     throw ValidationError.fromIssues(validationResult.issues);
 *   }
 *
 *   return await userService.create(userData);
 * }
 * ```
 */
export class ValidationError extends HttpError {
  /** Array of validation issues with paths and messages */
  public readonly issues: ValidationIssue[];

  /**
   * Creates a new ValidationError instance.
   *
   * @param message - Overall validation error message
   * @param issues - Array of validation issues
   */
  constructor(message: string, issues: ValidationIssue[]) {
    super(400, message, {
      code: 'VALIDATION_ERROR',
      details: { issues },
      expose: true,
    });
    this.name = 'ValidationError';
    this.issues = issues;
  }

  /**
   * Convenience method to create a ValidationError from issues.
   *
   * @param issues - Array of validation issues
   * @param message - Optional custom message (default: 'Validation failed')
   * @returns New ValidationError instance
   *
   * @example
   * ```typescript
   * const error = ValidationError.fromIssues([
   *   { path: ['body', 'email'], message: 'Invalid email format' }
   * ]);
   * ```
   */
  static fromIssues(issues: ValidationIssue[], message = 'Validation failed'): ValidationError {
    return new ValidationError(message, issues);
  }
}
