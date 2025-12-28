import express, { type Express, type Router } from 'express';
import type { ControllerCtor, Registry } from '../../core/registry/types.js';
import type { Validator } from '../../contracts/validator.js';
import { buildRegistry } from '../../core/registry/buildRegistry.js';
import { applyRegistryToExpressRouter, type ApplyRoutesOptions } from './router.js';
import {
  adornErrorHandler,
  createAdornExpressErrorHandler,
  type AdornErrorHandlerOptions,
} from './middleware/errorHandler.js';
import type { OpenApiBuildOptions } from '../../core/openapi/buildOpenApi.js';
import { serveOpenApi } from './swagger/serve.js';

/**
 * Options for OpenAPI documentation generation and serving.
 * Extends OpenApiBuildOptions with serving configuration.
 */
export type AdornOpenApiOptions = OpenApiBuildOptions & {
  /** Whether to enable OpenAPI documentation (default: true) */
  enabled?: boolean;
  /** Path to serve the OpenAPI JSON specification (default: '/openapi.json') */
  jsonPath?: string;
  /** Path to serve the OpenAPI documentation UI (default: '/docs') */
  docsPath?: string;
  /** Whether to serve Swagger UI (default: true) */
  swaggerUi?: boolean;
  /** Configuration options for Swagger UI */
  swaggerUiConfig?: Record<string, unknown>;
};

/**
 * Options for creating an Adorn Express router with controllers.
 *
 * @see ApplyRoutesOptions for additional routing options
 */
export type CreateAdornExpressRouterOptions = ApplyRoutesOptions & {
  /** Array of controller constructors to register */
  controllers: ControllerCtor[];
  /** Whether to automatically add JSON body parser middleware (default: true) */
  jsonBodyParser?: boolean;
  /** Validator instance for request validation */
  validator?: Validator;
  /** Error handler configuration or false to disable (default: built-in handler) */
  errorHandler?: AdornErrorHandlerOptions | false;
  /** OpenAPI documentation configuration */
  openapi?: AdornOpenApiOptions;
};

/**
 * Result of creating an Adorn Express router.
 */
export type CreateAdornExpressRouterResult = {
  /** Configured Express router with all routes */
  router: Router;
  /** Route registry containing metadata about all registered routes */
  registry: Registry;
};

/**
 * Options for creating an Adorn Express application.
 * Extends router options with mount path configuration.
 *
 * @see CreateAdornExpressRouterOptions for base options
 */
export type CreateAdornExpressAppOptions = CreateAdornExpressRouterOptions & {
  /** Path to mount the router (default: '/') */
  mountPath?: string;
};

/**
 * Creates a complete Express application with Adorn API functionality.
 *
 * This function sets up an Express app with all Adorn features including:
 * - Controller-based routing
 * - Automatic OpenAPI documentation
 * - Built-in error handling
 * - Request validation
 *
 * @param options - Configuration options for the application
 * @returns Configured Express application instance
 *
 * @example
 * ```typescript
 * import { createAdornExpressApp } from '@adorn/api';
 * import { UserController } from './controllers/user.controller';
 *
 * const app = createAdornExpressApp({
 *   controllers: [UserController],
 *   openapi: {
 *     title: 'My API',
 *     version: '1.0.0'
 *   }
 * });
 *
 * app.listen(3000, () => {
 *   console.log('Server running on port 3000');
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom mount path
 * const app = createAdornExpressApp({
 *   controllers: [UserController, ProductController],
 *   mountPath: '/api/v1',
 *   jsonBodyParser: true,
 *   errorHandler: {
 *     logErrors: true,
 *     exposeStack: process.env.NODE_ENV === 'development'
 *   }
 * });
 * ```
 *
 * @see createAdornExpressRouter for router-specific functionality
 * @see AdornOpenApiOptions for OpenAPI configuration
 */
export function createAdornExpressApp(options: CreateAdornExpressAppOptions): Express {
  const app = express();
  const { router } = createAdornExpressRouter(options);
  app.use(options.mountPath ?? '/', router);
  return app;
}

/**
 * Creates an Express router with Adorn API functionality.
 *
 * This function sets up an Express router with all Adorn features including:
 * - Controller-based routing
 * - Automatic OpenAPI documentation
 * - Built-in error handling
 * - Request validation
 *
 * @param options - Configuration options for the router
 * @returns Object containing the configured router and route registry
 *
 * @example
 * ```typescript
 * import { createAdornExpressRouter } from '@adorn/api';
 * import { UserController } from './controllers/user.controller';
 * import express from 'express';
 *
 * const app = express();
 * const { router, registry } = createAdornExpressRouter({
 *   controllers: [UserController],
 *   openapi: {
 *     title: 'My API',
 *     version: '1.0.0',
 *     docsPath: '/api-docs'
 *   }
 * });
 *
 * app.use('/api', router);
 *
 * // Access the registry for runtime inspection
 * console.log('Registered routes:', registry.routes.length);
 * ```
 *
 * @example
 * ```typescript
 * // With custom validator and error handling
 * const { router } = createAdornExpressRouter({
 *   controllers: [UserController],
 *   validator: new CustomValidator(),
 *   errorHandler: {
 *     logErrors: true,
 *     customErrorFormatter: (err) => ({ ...err, timestamp: new Date() })
 *   }
 * });
 * ```
 *
 * @see createAdornExpressApp for full application setup
 * @see AdornOpenApiOptions for OpenAPI configuration
 */
export function createAdornExpressRouter(
  options: CreateAdornExpressRouterOptions,
): CreateAdornExpressRouterResult {
  const router = express.Router();

  if (options.jsonBodyParser ?? true) {
    router.use(express.json());
  }

  const registry = buildRegistry(options.controllers);
  applyRegistryToExpressRouter(router, registry, options);

  const oa = options.openapi;
  if (oa?.enabled ?? true) {
    if (oa?.title && oa?.version) {
      const openApiOptions: OpenApiBuildOptions = {
        title: oa.title,
        version: oa.version,
        ...(oa.servers !== undefined ? { servers: oa.servers } : {}),
      };
      const serveOptions = {
        ...(oa.jsonPath !== undefined ? { jsonPath: oa.jsonPath } : {}),
        ...(oa.docsPath !== undefined ? { docsPath: oa.docsPath } : {}),
        ...(oa.swaggerUi !== undefined ? { swaggerUi: oa.swaggerUi } : {}),
        ...(oa.swaggerUiConfig !== undefined ? { swaggerUiConfig: oa.swaggerUiConfig } : {}),
      };

      router.use(serveOpenApi(registry, openApiOptions, serveOptions));
    }
  }

  if (options.errorHandler !== false) {
    const handler = options.errorHandler
      ? createAdornExpressErrorHandler(options.errorHandler)
      : adornErrorHandler;
    router.use(handler);
  }

  return { router, registry };
}
