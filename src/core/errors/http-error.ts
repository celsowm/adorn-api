import type { HttpErrorLike, HttpErrorOptions } from '../../contracts/errors.js';

/**
 * HTTP Error class for representing HTTP errors with status codes.
 *
 * This class extends the native Error class and implements HttpErrorLike interface.
 * It's used throughout the framework to represent HTTP errors that should be
 * returned to clients with appropriate status codes and error details.
 *
 * @example
 * ```typescript
 * // Basic usage
 * throw new HttpError(404, 'User not found');
 *
 * // With error code and details
 * throw new HttpError(400, 'Invalid input', {
 *   code: 'INVALID_INPUT',
 *   details: { field: 'email', reason: 'must be valid email' }
 * });
 *
 * // For internal server errors (not exposed to client by default)
 * throw new HttpError(500, 'Database connection failed', {
 *   expose: false
 * });
 * ```
 *
 * @example
 * ```typescript
 * // In a controller
 * @Get('/users/:id')
 * async getUser(id: string) {
 *   const user = await userService.findById(id);
 *   if (!user) {
 *     throw new HttpError(404, 'User not found', {
 *       code: 'USER_NOT_FOUND',
 *       details: { id }
 *     });
 *   }
 *   return user;
 * }
 * ```
 */
export class HttpError extends Error implements HttpErrorLike {
  /** HTTP status code (e.g., 404, 500) */
  public readonly status: number;
  /** Optional error code for programmatic handling */
  public readonly code?: string;
  /** Additional error details (can be any type) */
  public readonly details?: unknown;
  /** Whether to expose this error to clients */
  public readonly expose: boolean;

  /**
   * Creates a new HttpError instance.
   *
   * @param status - HTTP status code
   * @param message - Error message
   * @param options - Additional error options
   * @param options.code - Optional error code
   * @param options.details - Additional error details
   * @param options.expose - Whether to expose to clients (default: true for 4xx, false for 5xx)
   */
  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (options.code !== undefined) {
      this.code = options.code;
    }
    this.details = options.details;
    this.expose = options.expose ?? (status >= 400 && status < 500);
  }
}
