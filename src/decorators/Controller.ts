import { getBucket } from "../runtime/metadata/bucket.js";

/**
 * Decorator to mark a class as a controller with a base path.
 * All methods in the controller will be relative to this base path.
 * 
 * @param basePath - The base path for all routes in this controller
 * 
 * @example
 * ```ts
 * @Controller("/users")
 * export class UsersController {
 *   @Get("/:id")
 *   getUser() { }
 * }
 * ```
 */
export function Controller(basePath: string) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    context: ClassDecoratorContext<T>
  ): T | void {
    const bucket = getBucket(context.metadata);
    bucket.basePath = basePath;
  };
}
