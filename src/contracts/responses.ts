import type { Schema } from '../validation/native/schema.js';

/**
 * Specification for response content including schema and example.
 *
 * @template T - The type that the schema validates
 */
export type ResponseContentSpec = {
  /** Schema defining the structure and validation rules for the response content */
  schema: Schema<unknown>;
  /** Example value that matches the schema */
  example?: unknown;
};

/**
 * Specification for HTTP response headers.
 *
 * @template T - The type that the schema validates
 */
export type HeaderSpec = {
  /** Schema defining the structure and validation rules for the header */
  schema: Schema<unknown>;
  /** Human-readable description of the header */
  description?: string;
  /** Whether the header is required */
  required?: boolean;
};

/**
 * Complete specification for an HTTP response.
 *
 * This type defines all aspects of an HTTP response including status codes,
 * content types, headers, and schemas. It's used to document and validate
 * API responses.
 *
 * @example
 * ```typescript
 * const successResponse: ResponseSpec = {
 *   description: 'User created successfully',
 *   headers: {
 *     'X-Request-ID': {
 *       schema: Schema.String(),
 *       description: 'Unique request identifier',
 *       required: true
 *     }
 *   },
 *   content: {
 *     'application/json': {
 *       schema: userSchema,
 *       example: { id: '123', name: 'John Doe', email: 'john@example.com' }
 *     }
 *   }
 * };
 * ```
 *
 * @see Schema for schema definition
 */
export type ResponseSpec = {
  /** Human-readable description of the response */
  description?: string;
  /** Response headers specification */
  headers?: Record<string, HeaderSpec>;
  /** Response content by media type */
  content?: Record<string, ResponseContentSpec>;
  /** Legacy schema property (use content instead for proper media type handling) */
  schema?: Schema<unknown>;
};

/**
 * Collection of response specifications keyed by HTTP status code.
 *
 * This type represents all possible responses for a given endpoint,
 * with status codes as keys and ResponseSpec objects as values.
 *
 * @example
 * ```typescript
 * const userResponses: ResponsesSpec = {
 *   '200': {
 *     description: 'User found',
 *     content: {
 *       'application/json': {
 *         schema: userSchema,
 *         example: { id: '123', name: 'John Doe' }
 *       }
 *     }
 *   },
 *   '404': {
 *     description: 'User not found',
 *     content: {
 *       'application/json': {
 *         schema: errorSchema,
 *         example: { error: 'User not found', code: 'USER_NOT_FOUND' }
 *       }
 *     }
 *   }
 * };
 * ```
 *
 * @see ResponseSpec for individual response specification
 */
export type ResponsesSpec = Record<string, ResponseSpec | Schema<unknown>>;
