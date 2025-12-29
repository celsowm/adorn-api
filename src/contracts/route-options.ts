import type { ResponsesSpec } from './responses.js';
import type { Schema } from '../validation/native/schema.js';
import type { ExtractPathParams } from '../core/typing/path-params.js';
import type { SecurityRequirementObject } from './openapi-v3.js';

/**
 * Type hints for path parameter coercion.
 *
 * These hints are used to automatically convert path parameters
 * to specific types during request processing.
 */
export type ScalarHint = 'string' | 'int' | 'number' | 'boolean' | 'uuid';

/**
 * Validation configuration for route parameters.
 *
 * Specifies schemas for validating different parts of the request.
 *
 * @example
 * ```typescript
 * const routeValidation: RouteValidate = {
 *   params: Schema.Object({
 *     id: Schema.String().format('uuid')
 *   }),
 *   query: Schema.Object({
 *     limit: Schema.Number().min(1).max(100),
 *     offset: Schema.Number().min(0)
 *   }),
 *   body: Schema.Object({
 *     title: Schema.String().minLength(3),
 *     content: Schema.String().minLength(10)
 *   })
 * };
 * ```
 *
 * @see Schema for schema definition
 */
export type RouteValidate = {
  /** Schema for validating path parameters */
  params?: Schema<unknown>;
  /** Schema for validating query parameters */
  query?: Schema<unknown>;
  /** Schema for validating request body */
  body?: Schema<unknown>;
};

/**
 * Parameter binding configuration for routes.
 *
 * Specifies how path parameters should be coerced to specific types.
 *
 * @template Path - The route path as a string literal
 *
 * @example
 * ```typescript
 * // For route '/users/:id/:status'
 * const routeBindings: RouteBindings<'/users/:id/:status'> = {
 *   path: {
 *     id: 'uuid',      // Coerce to UUID format
 *     status: 'string' // Keep as string
 *   }
 * };
 * ```
 *
 * @see ScalarHint for available type hints
 */
export type RouteBindings<Path extends string> = {
  /** Type hints for path parameters */
  path?: Partial<Record<ExtractPathParams<Path>, ScalarHint>>;
};

/**
 * Complete route configuration options.
 *
 * This type defines all available options for configuring a route,
 * including OpenAPI documentation, validation, parameter binding,
 * and response specifications.
 *
 * @template Path - The route path as a string literal
 *
 * @example
 * ```typescript
 * const userRouteOptions: RouteOptions<'/users/:id'> = {
 *   summary: 'Get user by ID',
 *   description: 'Retrieves a user by their unique identifier',
 *   tags: ['Users'],
 *   operationId: 'getUserById',
 *   deprecated: false,
 *   security: [{ bearerAuth: [] }],
 *
 *   validate: {
 *     params: Schema.Object({
 *       id: Schema.String().format('uuid')
 *     })
 *   },
 *
 *   bindings: {
 *     path: { id: 'uuid' }
 *   },
 *
 *   responses: {
 *     '200': {
 *       description: 'User found',
 *       content: {
 *         'application/json': {
 *           schema: userSchema,
 *           example: { id: '123', name: 'John Doe' }
 *         }
 *       }
 *     },
 *     '404': {
 *       description: 'User not found'
 *     }
 *   },
 *
 *   successStatus: 200
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Minimal route options
 * const simpleRouteOptions: RouteOptions = {
 *   summary: 'Health check',
 *   responses: {
 *     '200': { description: 'Service is healthy' }
 *   }
 * };
 * ```
 *
 * @see ResponsesSpec for response specification format
 * @see RouteValidate for validation configuration
 * @see RouteBindings for parameter binding configuration
 */
export type RouteOptions<Path extends string = string> = {
  /** Short summary of the endpoint */
  summary?: string;
  /** Detailed description of the endpoint */
  description?: string;
  /** Tags for grouping endpoints in documentation */
  tags?: string[];
  /** Unique identifier for the operation */
  operationId?: string;
  /** Whether the endpoint is deprecated */
  deprecated?: boolean;
  /** Security requirements for the endpoint */
  security?: SecurityRequirementObject[];

  /** Validation configuration for request parts */
  validate?: RouteValidate;
  /** Parameter binding configuration */
  bindings?: RouteBindings<Path>;

  /** Response specifications by status code */
  responses?: ResponsesSpec;
  /** Default success status code */
  successStatus?: number;

  /** Allow additional custom properties */
  [k: string]: unknown;
};
