import type { BindingsMeta, ControllerMeta, RouteMeta } from '../../metadata/keys.js';
import type { SecuritySchemeObject } from '../../contracts/openapi-v3.js';

/**
 * Constructor type for controller classes.
 *
 * Represents a class constructor that can be instantiated
 * to create controller instances for handling requests.
 *
 * @template T - The controller instance type
 *
 * @example
 * ```typescript
 * // Controller class
 * class UserController {
 *   @Get('/users')
 *   async listUsers() {
 *     return await userService.findAll();
 *   }
 * }
 *
 * // Controller constructor type
 * const UserControllerCtor: ControllerCtor<UserController> = UserController;
 * ```
 */
export type ControllerCtor<T = any> = new (...args: any[]) => T;

/**
 * Registry entry for a controller.
 *
 * Contains the controller constructor and its associated metadata,
 * which is used during route registration and runtime processing.
 *
 * @example
 * ```typescript
 * // Controller entry in registry
 * const userControllerEntry: ControllerEntry = {
 *   ctor: UserController,
 *   meta: {
 *     basePath: '/api/v1/users'
 *   }
 * };
 * ```
 */
export type ControllerEntry = {
  /** Controller constructor function */
  ctor: ControllerCtor;
  /** Controller metadata including base path */
  meta: ControllerMeta;
};

/**
 * Registry entry for an individual route.
 *
 * Contains comprehensive information about a route including its HTTP method,
 * path templates, controller association, and configuration options.
 * This information is used for request routing, OpenAPI generation,
 * and runtime route processing.
 *
 * @example
 * ```typescript
 * // Route entry for a GET /users/:id endpoint
 * const userRouteEntry: RouteEntry = {
 *   method: 'GET',
 *   fullPath: '/users/{id}',
 *   routePath: '/{id}',
 *   handlerName: 'getUser',
 *   controller: UserController,
 *   options: {
 *     summary: 'Get user by ID',
 *     responses: {
 *       200: { description: 'User found' },
 *       404: { description: 'User not found' }
 *     }
 *   },
 *   bindings: {
 *     byMethod: {
 *       getUser: {
 *         path: { id: 'uuid' }
 *       }
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Route entry for a POST /users endpoint
 * const createUserRouteEntry: RouteEntry = {
 *   method: 'POST',
 *   fullPath: '/users',
 *   routePath: '/',
 *   handlerName: 'createUser',
 *   controller: UserController,
 *   options: {
 *     summary: 'Create new user',
 *     responses: {
 *       201: { description: 'User created' },
 *       400: { description: 'Invalid user data' }
 *     }
 *   }
 * };
 * ```
 */
export type RouteEntry = {
  /** HTTP method for this route */
  method: RouteMeta['method'];
  /**
   * Full, normalized path template, e.g. "/users/{id}"
   *
   * This includes the controller base path combined with the route path
   */
  fullPath: string;

  /**
   * Raw route template as declared on the method, e.g. "/{id}"
   *
   * This is the path template as written in the decorator
   */
  routePath: string;

  /**
   * The handler name on the controller, e.g. "get"
   *
   * This is the method name where the route is defined
   */
  handlerName: string;

  /** Controller constructor that defines this route */
  controller: ControllerCtor;

  /**
   * Whatever the decorator carried (docs/security/etc). Compiler can refine later.
   *
   * Contains route-specific configuration including documentation,
   * security requirements, responses, and other metadata
   */
  options?: unknown;
  /** Parameter binding configuration for this route */
  bindings?: BindingsMeta;
};

/**
 * Complete route registry containing all registered controllers and routes.
 *
 * The registry is the central data structure that contains all the metadata
 * needed for request routing, OpenAPI documentation generation,
 * and runtime processing. It's built during application startup
 * by scanning controller classes and their decorators.
 *
 * @example
 * ```typescript
 * // Example registry with user and product controllers
 * const appRegistry: Registry = {
 *   controllers: [
 *     {
 *       ctor: UserController,
 *       meta: { basePath: '/api/v1/users' }
 *     },
 *     {
 *       ctor: ProductController,
 *       meta: { basePath: '/api/v1/products' }
 *     }
 *   ],
 *   routes: [
 *     // UserController routes
 *     {
 *       method: 'GET',
 *       fullPath: '/api/v1/users',
 *       routePath: '/',
 *       handlerName: 'listUsers',
 *       controller: UserController,
 *       options: { summary: 'List all users' }
 *     },
 *     {
 *       method: 'GET',
 *       fullPath: '/api/v1/users/{id}',
 *       routePath: '/{id}',
 *       handlerName: 'getUser',
 *       controller: UserController,
 *       options: { summary: 'Get user by ID' }
 *     },
 *     // ProductController routes
 *     {
 *       method: 'GET',
 *       fullPath: '/api/v1/products',
 *       routePath: '/',
 *       handlerName: 'listProducts',
 *       controller: ProductController,
 *       options: { summary: 'List all products' }
 *     }
 *   ],
 *   securitySchemes: {
 *     bearerAuth: {
 *       type: 'http',
 *       scheme: 'bearer',
 *       bearerFormat: 'JWT'
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using the registry for OpenAPI generation
 * import { buildOpenApi } from './openapi';
 *
 * const registry = buildRegistry([UserController, ProductController]);
 * const openApiDoc = buildOpenApi(registry, {
 *   title: 'My API',
 *   version: '1.0.0'
 * });
 *
 * // Using the registry for Express routing
 * import { applyRegistryToExpressRouter } from './express';
 *
 * const router = express.Router();
 * applyRegistryToExpressRouter(router, registry);
 * ```
 *
 * @see buildRegistry for creating registries from controllers
 * @see buildOpenApi for OpenAPI documentation generation
 * @see applyRegistryToExpressRouter for Express integration
 */
export type Registry = {
  /** Array of all registered controllers */
  controllers: ControllerEntry[];
  /** Array of all registered routes */
  routes: RouteEntry[];
  /** Security schemes available for the API */
  securitySchemes?: Record<string, SecuritySchemeObject>;
};
