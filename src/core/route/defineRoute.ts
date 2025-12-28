import type { ResponsesSpec } from '../../contracts/responses.js';
import type { RouteOptions } from '../../contracts/route-options.js';
import { makeReply } from '../reply/typed.js';

/**
 * Route definition that carries:
 * - path: use in decorator
 * - options: use in decorator
 * - reply: typed reply/noContent bound to responses
 *
 * @template Path - The route path as a string literal
 * @template R - The responses specification for this route
 */
export type RouteDef<Path extends string, R extends ResponsesSpec> = {
  /** The route path */
  path: Path;
  /** Route configuration and responses */
  options: RouteOptions<Path> & { responses: R };
  /** Typed reply function bound to the route's responses */
  reply: ReturnType<typeof makeReply<R>>;
};

/**
 * Creates a route definition with typed responses and reply functions.
 *
 * @template Path - The route path as a string literal
 * @template R - The responses specification for this route
 * @param path - The route path (e.g., '/users', '/users/:id')
 * @param options - Route configuration including responses specification
 * @returns Route definition with typed reply function
 *
 * @example
 * ```typescript
 * const userRoute = defineRoute('/users', {
 *   responses: {
 *     200: { content: { 'application/json': { schema: userSchema } } },
 *     404: { description: 'User not found' }
 *   }
 * });
 *
 * // Use the typed reply function
 * const reply = userRoute.reply(200, userData);
 * ```
 *
 * @see RouteOptions for available configuration options
 * @see ResponsesSpec for response specification format
 */
export function defineRoute<Path extends string, const R extends ResponsesSpec>(
  path: Path,
  options: RouteOptions<Path> & { responses: R },
): RouteDef<Path, R> {
  return {
    path,
    options,
    reply: makeReply(options.responses),
  };
}

/**
 * Nice builder style for route definitions:
 *   const getUser = routeFor('/{id}')({ ... })
 *
 * @template Path - The route path as a string literal
 * @param path - The route path
 * @returns A function that takes route options and returns a RouteDef
 *
 * @example
 * ```typescript
 * const getUserRoute = routeFor('/users/:id')({
 *   responses: {
 *     200: { content: { 'application/json': { schema: userSchema } } },
 *     404: { description: 'User not found' }
 *   }
 * });
 * ```
 *
 * @see defineRoute for the underlying implementation
 */
export function routeFor<Path extends string>(path: Path) {
  return function <const R extends ResponsesSpec>(
    options: RouteOptions<Path> & { responses: R },
  ): RouteDef<Path, R> {
    return defineRoute(path, options);
  };
}
