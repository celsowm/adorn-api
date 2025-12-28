/**
 * Stage-3 decorators store metadata in a "metadata bag" accessible at runtime via:
 *   MyClass[Symbol.metadata]
 *
 * Some runtimes may not have Symbol.metadata yet; TypeScript's emit still uses it,
 * so we polyfill Symbol.metadata to a stable symbol if missing.
 */
import type { ResponsesSpec } from '../contracts/responses.js';
import type { RouteOptions } from '../contracts/route-options.js';
import type { SecurityRequirementObject, SecuritySchemeObject } from '../contracts/openapi-v3.js';

export const SYMBOL_METADATA: symbol = (() => {
  const existing = (Symbol as any).metadata;
  if (typeof existing === 'symbol') return existing;

  const created = Symbol('Symbol.metadata');
  (Symbol as any).metadata = created;
  return created;
})();

/**
 * All adorn-api metadata keys live here.
 * Use Symbol.for so keys stay stable across internal modules/bundles.
 */
export const META = {
  controller: Symbol.for('adorn-api:controller'),
  routes: Symbol.for('adorn-api:routes'),
  db: Symbol.for('adorn-api:db'),
  middleware: Symbol.for('adorn-api:middleware'),
  security: Symbol.for('adorn-api:security'),
  docs: Symbol.for('adorn-api:docs'),
  bindings: Symbol.for('adorn-api:bindings'),
} as const;

/**
 * Metadata shape for controller-level configuration.
 *
 * Stores base path information for controllers that can be used
 * to prefix all routes defined within the controller.
 *
 * @example
 * ```typescript
 * // Controller with base path metadata
 * const controllerMeta: ControllerMeta = {
 *   basePath: '/api/v1'
 * };
 *
 * // This would make all routes in the controller start with /api/v1
 * ```
 */
export type ControllerMeta = {
  /** Base path for all routes in this controller */
  basePath: string;
};

/**
 * Metadata shape for individual route definitions.
 *
 * Stores information about HTTP methods, paths, route names,
 * and additional route-specific configuration.
 *
 * @example
 * ```typescript
 * // Route metadata for a GET endpoint
 * const routeMeta: RouteMeta = {
 *   method: 'GET',
 *   path: '/users/:id',
 *   name: 'getUser',
 *   options: {
 *     summary: 'Get user by ID',
 *     responses: {
 *       200: { description: 'User found' },
 *       404: { description: 'User not found' }
 *     }
 *   }
 * };
 * ```
 */
export type RouteMeta = {
  /** HTTP method for this route */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Route path template */
  path: string;
  /** Method name on the controller */
  name: string;
  /** Additional route configuration options */
  options?: unknown;
};

/**
 * Metadata shape for database transaction configuration.
 *
 * Controls transactional behavior for database operations
 * associated with routes or controllers.
 *
 * @example
 * ```typescript
 * // Automatic transaction (default)
 * const autoTransaction: DbMeta = {
 *   transactional: 'auto'
 * };
 *
 * // Required transaction
 * const requiredTransaction: DbMeta = {
 *   transactional: 'required'
 * };
 *
 * // No transaction
 * const noTransaction: DbMeta = {
 *   transactional: 'none'
 * };
 * ```
 */
export type DbMeta = {
  /**
   * Transactional behavior:
   * - 'auto': Automatic transaction management (default)
   * - 'required': Requires existing transaction
   * - 'none': No transaction
   */
  transactional: 'auto' | 'required' | 'none';
};

/**
 * Binding hint for parameter binding configuration.
 *
 * Specifies how parameters should be bound from different
 * sources (path, query, body) with optional type hints.
 *
 * @example
 * ```typescript
 * // Path parameter with type hint
 * const pathHint: BindingHint = {
 *   kind: 'path',
 *   name: 'id',
 *   type: 'uuid'
 * };
 *
 * // Query parameter
 * const queryHint: BindingHint = {
 *   kind: 'query',
 *   name: 'limit'
 * };
 *
 * // Body binding
 * const bodyHint: BindingHint = {
 *   kind: 'body'
 * };
 * ```
 */
export type BindingHint =
  | { kind: 'path'; name: string; type?: 'string' | 'int' | 'number' | 'boolean' | 'uuid' }
  | { kind: 'query'; name?: string }
  | { kind: 'body' };

/**
 * Metadata shape for parameter binding configuration.
 *
 * Stores binding hints organized by method name for
 * fine-grained control over parameter binding behavior.
 *
 * @example
 * ```typescript
 * // Binding metadata for a controller
 * const bindingsMeta: BindingsMeta = {
 *   byMethod: {
 *     'getUser': {
 *       path: {
 *         id: 'uuid',      // Bind id parameter as UUID
 *         status: 'string' // Bind status parameter as string
 *       }
 *     },
 *     'createUser': {
 *       path: {
 *         teamId: 'int'    // Bind teamId parameter as integer
 *       }
 *     }
 *   }
 * };
 * ```
 */
export type BindingsMeta = {
  /**
   * Binding configuration by method name
   * @template MethodName - Name of the controller method
   */
  byMethod?: Record<
    string,
    {
      /** Type hints for path parameters */
      path?: Record<string, 'string' | 'int' | 'number' | 'boolean' | 'uuid'>;
    }
  >;
};

/**
 * Metadata shape for OpenAPI documentation configuration.
 *
 * Stores documentation-related information including tags,
 * security requirements, responses, and method-specific docs.
 *
 * @example
 * ```typescript
 * // Comprehensive documentation metadata
 * const docsMeta: DocsMeta = {
 *   tags: ['Users', 'API'],
 *   deprecated: false,
 *   operationId: 'getUserById',
 *   security: [{ bearerAuth: [] }],
 *   responses: {
 *     200: { description: 'User found' },
 *     404: { description: 'User not found' }
 *   },
 *   byMethod: {
 *     'getUser': {
 *       summary: 'Get user by ID',
 *       description: 'Retrieves a user by their unique identifier'
 *     }
 *   }
 * };
 * ```
 */
export type DocsMeta = {
  /** Tags for API documentation grouping */
  tags?: string[];
  /** Whether this endpoint is deprecated */
  deprecated?: boolean;
  /** Unique operation identifier */
  operationId?: string;
  /** Security requirements for this endpoint */
  security?: SecurityRequirementObject[];
  /** Response specifications */
  responses?: ResponsesSpec;
  /** Method-specific documentation overrides */
  byMethod?: Record<string, Partial<RouteOptions<string>>>;
};

/**
 * Metadata shape for security scheme definitions.
 *
 * Stores security schemes that can be referenced by
 * routes and controllers for authentication/authorization.
 *
 * @example
 * ```typescript
 * // Security metadata with multiple schemes
 * const securityMeta: SecurityMeta = {
 *   schemes: {
 *     bearerAuth: {
 *       type: 'http',
 *       scheme: 'bearer',
 *       bearerFormat: 'JWT'
 *     },
 *     apiKey: {
 *       type: 'apiKey',
 *       name: 'X-API-Key',
 *       in: 'header'
 *     }
 *   }
 * };
 * ```
 */
export type SecurityMeta = {
  /** Security schemes available for this API */
  schemes?: Record<string, SecuritySchemeObject>;
};
