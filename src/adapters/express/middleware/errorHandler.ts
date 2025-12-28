import type { ErrorRequestHandler, Request, Response } from 'express';
import type { ProblemDetails } from '../../../contracts/errors.js';
import { toProblemDetails } from '../../../core/errors/problem.js';

/**
 * Context object provided to custom error handlers.
 *
 * Contains the Express request and response objects, the request path,
 * and the default problem details that would be returned.
 */
export type AdornErrorHandlerContext = {
  /** Express request object */
  req: Request;
  /** Express response object */
  res: Response;
  /** Request path/URL */
  instance: string;
  /** Default problem details that would be returned */
  defaultProblem: ProblemDetails;
};

/**
 * Result types that can be returned from a custom error handler.
 *
 * Supports returning ProblemDetails, custom responses, or void (to use default).
 */
export type AdornErrorHandlerResult =
  | ProblemDetails
  | {
      status: number;
      body: unknown;
      headers?: Record<string, string>;
    }
  | void;

/**
 * Options for configuring the Adorn error handler.
 *
 * Allows customization of error handling behavior through the onError callback.
 */
export type AdornErrorHandlerOptions = {
  /**
   * Custom error handler function.
   *
   * @param err - The error that occurred
   * @param ctx - Error handler context with request/response info
   * @returns Custom error response, problem details, or void to use default
   *
   * @example
   * ```typescript
   * // Custom error formatting
   * onError: (err, ctx) => {
   *   if (err instanceof ValidationError) {
   *     return {
   *       status: 400,
   *       body: {
   *         success: false,
   *         errors: err.issues,
   *         timestamp: new Date().toISOString()
   *       }
   *     };
   *   }
   *   return ctx.defaultProblem; // Use default for other errors
   * }
   * ```
   */
  onError?: (err: unknown, ctx: AdornErrorHandlerContext) => AdornErrorHandlerResult;
};

const defaultErrorHandler = createAdornExpressErrorHandler();

/**
 * Default Adorn error handler for Express applications.
 *
 * This is the built-in error handler that converts errors to appropriate
 * HTTP responses. It handles HttpError, ValidationError, and other errors
 * by converting them to Problem Details format.
 *
 * @param err - The error that occurred
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @example
 * ```typescript
 * // Basic usage in Express app
 * import { adornErrorHandler } from '@adorn/api';
 *
 * const app = express();
 * // ... routes and middleware
 * app.use(adornErrorHandler); // Use as last middleware
 * ```
 *
 * @example
 * ```typescript
 * // With custom error handling
 * app.use((err, req, res, next) => {
 *   // Custom logging
 *   console.error('Error occurred:', err);
 *
 *   // Use adorn error handler
 *   adornErrorHandler(err, req, res, next);
 * });
 * ```
 *
 * @see createAdornExpressErrorHandler for customizable error handler
 * @see HttpError for HTTP error class
 */
export function adornErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: Parameters<ErrorRequestHandler>[3],
) {
  return defaultErrorHandler(err, req, res, next);
}

/**
 * Creates a customizable Adorn error handler for Express applications.
 *
 * This function allows customization of error handling behavior while
 * maintaining the core functionality of converting errors to appropriate
 * HTTP responses.
 *
 * @param options - Error handler configuration options
 * @returns Express error request handler function
 *
 * @example
 * ```typescript
 * // Basic custom error handler
 * const errorHandler = createAdornExpressErrorHandler({
 *   onError: (err, ctx) => {
 *     // Add custom logging
 *     console.error('Error:', err.message, 'Path:', ctx.instance);
 *
 *     // Return default problem details
 *     return ctx.defaultProblem;
 *   }
 * });
 *
 * app.use(errorHandler);
 * ```
 *
 * @example
 * ```typescript
 * // Advanced error handling with custom responses
 * const errorHandler = createAdornExpressErrorHandler({
 *   onError: (err, ctx) => {
 *     if (err instanceof ValidationError) {
 *       return {
 *         status: 400,
 *         body: {
 *           success: false,
 *           type: 'validation_error',
 *           issues: err.issues,
 *           timestamp: new Date().toISOString(),
 *           requestId: ctx.req.id
 *         },
 *         headers: {
 *           'X-Error-Type': 'validation'
 *         }
 *       };
 *     }
 *
 *     if (err instanceof HttpError && err.status === 404) {
 *       return {
 *         status: 404,
 *         body: {
 *           success: false,
 *           type: 'not_found',
 *           message: 'Resource not found',
 *           details: err.details
 *         }
 *       };
 *     }
 *
 *     // Use default for other errors
 *     return ctx.defaultProblem;
 *   }
 * });
 *
 * app.use(errorHandler);
 * ```
 *
 * @example
 * ```typescript
 * // Error handler with request ID correlation
 * const errorHandler = createAdornExpressErrorHandler({
 *   onError: (err, ctx) => {
 *     const requestId = ctx.req.headers['x-request-id'] || ctx.req.id;
 *
 *     // Add request ID to all error responses
 *     const problem = ctx.defaultProblem;
 *     return {
 *       ...problem,
 *       body: {
 *         ...problem,
 *         requestId,
 *         timestamp: new Date().toISOString()
 *       }
 *     };
 *   }
 * });
 *
 * app.use(errorHandler);
 * ```
 *
 * @see adornErrorHandler for the default error handler
 * @see AdornErrorHandlerOptions for configuration options
 */
export function createAdornExpressErrorHandler(
  options: AdornErrorHandlerOptions = {},
): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const instance = req.originalUrl || req.path;
    const defaultProblem = toProblemDetails(err, instance);

    const result = options.onError?.(err, {
      req,
      res,
      instance,
      defaultProblem,
    });

    if (res.headersSent) return;

    if (result && isCustomErrorResponse(result)) {
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
      }
      res.status(result.status).json(result.body);
      return;
    }

    if (result) {
      res.status(result.status).json(result);
      return;
    }

    res.status(defaultProblem.status).json(defaultProblem);
  };
}

function isCustomErrorResponse(value: AdornErrorHandlerResult): value is {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
} {
  return !!value && typeof value === 'object' && 'body' in value;
}
