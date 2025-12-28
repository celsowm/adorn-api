import type { ResponsesSpec } from '../../contracts/responses.js';
import type { RouteOptions } from '../../contracts/route-options.js';
import { makeReply } from '../reply/typed.js';

/**
 * Route definition that carries:
 * - path: use in decorator
 * - options: use in decorator
 * - reply: typed reply/noContent bound to responses
 */
export type RouteDef<Path extends string, const R extends ResponsesSpec> = {
  path: Path;
  options: RouteOptions<Path> & { responses: R };
  reply: ReturnType<typeof makeReply<R>>;
};

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
 * Nice builder style:
 *   const getUser = routeFor('/{id}')({ ... })
 */
export function routeFor<Path extends string>(path: Path) {
  return function <const R extends ResponsesSpec>(
    options: RouteOptions<Path> & { responses: R },
  ): RouteDef<Path, R> {
    return defineRoute(path, options);
  };
}
