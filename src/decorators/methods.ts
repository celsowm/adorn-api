import { META, type RouteMeta } from '../metadata/keys.js';
import { bagFromContext, bagPush } from '../metadata/bag.js';
import type { RouteOptions } from '../contracts/route-options.js';
import type { ResponsesSpec } from '../contracts/responses.js';
import type { Reply } from '../contracts/reply.js';
import type { Schema } from '../validation/native/schema.js';
import type {
  BodySchemaFor,
  SuccessStatusesWithBody,
  SuccessStatusesNoBody,
} from '../contracts/response-types.js';

type Stage3MethodContext = ClassMethodDecoratorContext<any, (this: any, ...args: any) => any>;
type MaybePromise<T> = T | Promise<T>;

type ResponsesFromOptions<O> = O extends { responses: infer R extends ResponsesSpec } ? R : undefined;

type BodySchemaFromResponses<R extends ResponsesSpec> =
  SuccessStatusesWithBody<R> extends never ? never : BodySchemaFor<R, SuccessStatusesWithBody<R>>;

type BodyTypeFromResponses<R extends ResponsesSpec | undefined> =
  R extends ResponsesSpec
    ? BodySchemaFromResponses<R> extends Schema<infer T> ? T : unknown
    : unknown;

type SuccessBodyType<O> = BodyTypeFromResponses<ResponsesFromOptions<O>>;

type ReplyWithBodyTypes<R extends ResponsesSpec | undefined> =
  R extends ResponsesSpec
    ? SuccessStatusesWithBody<R> extends never
      ? never
      : Reply<
          BodySchemaFromResponses<R> extends Schema<infer T> ? T : unknown,
          SuccessStatusesWithBody<R>
        >
    : never;

type ReplyNoBodyTypes<R extends ResponsesSpec | undefined> =
  R extends ResponsesSpec
    ? SuccessStatusesNoBody<R> extends never
      ? never
      : Reply<undefined, SuccessStatusesNoBody<R>>
    : never;

type IsNever<T> = [T] extends [never] ? true : false;

type HandlerReply<R extends ResponsesSpec | undefined> =
  R extends ResponsesSpec
    ? (IsNever<ReplyWithBodyTypes<R>> extends true ? never : ReplyWithBodyTypes<R>)
      | (IsNever<ReplyNoBodyTypes<R>> extends true ? never : ReplyNoBodyTypes<R>)
    : Reply<any, number>;

type HandlerReturn<O extends RouteOptions<string> | undefined> =
  MaybePromise<SuccessBodyType<O> | HandlerReply<ResponsesFromOptions<O>>>;

/**
 * Internal helper: store route metadata for a method.
 * @param context - The decorator context
 * @param route - Route metadata without the name property
 */
function addRoute(context: Stage3MethodContext, route: Omit<RouteMeta, 'name'>) {
  const bag = bagFromContext(context);
  const name = String(context.name);

  const meta: RouteMeta = {
    ...route,
    name,
  };

  bagPush<RouteMeta>(bag, META.routes, meta);
}

function normalizeRoutePath(p: string): string {
  if (!p) return '';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  if (out !== '/' && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function createMethodDecorator<Path extends string, const O extends RouteOptions<Path> | undefined>(
  method: RouteMeta['method'],
  path: Path,
  options?: O,
) {
  return function <This, Args extends any[], Ret extends HandlerReturn<O>>(
    value: (this: This, ...args: Args) => Ret,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Ret>,
  ) {
    addRoute(context, { method, path: normalizeRoutePath(path), options });
    return value;
  };
}

/**
 * Decorator for HTTP GET method endpoints.
 *
 * @template Path - The route path as a string literal
 * @template O - Route options extending RouteOptions for the path
 * @param path - The route path (e.g., '/users', '/users/:id')
 * @param options - Optional route configuration including responses, validation, etc.
 * @returns Method decorator for class methods
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Get('/users')
 *   async listUsers() {
 *     return await userService.findAll();
 *   }
 *
 *   @Get('/users/:id')
 *   async getUser(id: string) {
 *     return await userService.findById(id);
 *   }
 * }
 * ```
 *
 * @see RouteOptions for available configuration options
 */
export function Get<Path extends string, const O extends RouteOptions<Path> | undefined>(
  path: Path,
  options?: O,
) {
  return createMethodDecorator('GET', path, options);
}

/**
 * Decorator for HTTP POST method endpoints.
 *
 * @template Path - The route path as a string literal
 * @template O - Route options extending RouteOptions for the path
 * @param path - The route path (e.g., '/users', '/users/:id/comments')
 * @param options - Optional route configuration including responses, validation, etc.
 * @returns Method decorator for class methods
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Post('/users')
 *   async createUser(@Body() userData: CreateUserDto) {
 *     return await userService.create(userData);
 *   }
 *
 *   @Post('/users/:id/activate')
 *   async activateUser(id: string) {
 *     return await userService.activate(id);
 *   }
 * }
 * ```
 *
 * @see RouteOptions for available configuration options
 */
export function Post<Path extends string, const O extends RouteOptions<Path> | undefined>(
  path: Path,
  options?: O,
) {
  return createMethodDecorator('POST', path, options);
}

/**
 * Decorator for HTTP PUT method endpoints.
 *
 * @template Path - The route path as a string literal
 * @template O - Route options extending RouteOptions for the path
 * @param path - The route path (e.g., '/users/:id')
 * @param options - Optional route configuration including responses, validation, etc.
 * @returns Method decorator for class methods
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Put('/users/:id')
 *   async updateUser(id: string, @Body() userData: UpdateUserDto) {
 *     return await userService.update(id, userData);
 *   }
 * }
 * ```
 *
 * @see RouteOptions for available configuration options
 */
export function Put<Path extends string, const O extends RouteOptions<Path> | undefined>(
  path: Path,
  options?: O,
) {
  return createMethodDecorator('PUT', path, options);
}

/**
 * Decorator for HTTP PATCH method endpoints.
 *
 * @template Path - The route path as a string literal
 * @template O - Route options extending RouteOptions for the path
 * @param path - The route path (e.g., '/users/:id')
 * @param options - Optional route configuration including responses, validation, etc.
 * @returns Method decorator for class methods
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Patch('/users/:id')
 *   async partialUpdate(id: string, @Body() partialData: Partial<User>) {
 *     return await userService.patch(id, partialData);
 *   }
 * }
 * ```
 *
 * @see RouteOptions for available configuration options
 */
export function Patch<Path extends string, const O extends RouteOptions<Path> | undefined>(
  path: Path,
  options?: O,
) {
  return createMethodDecorator('PATCH', path, options);
}

/**
 * Decorator for HTTP DELETE method endpoints.
 *
 * @template Path - The route path as a string literal
 * @template O - Route options extending RouteOptions for the path
 * @param path - The route path (e.g., '/users/:id')
 * @param options - Optional route configuration including responses, validation, etc.
 * @returns Method decorator for class methods
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Delete('/users/:id')
 *   async deleteUser(id: string) {
 *     await userService.delete(id);
 *     return { success: true };
 *   }
 *
 *   @Delete('/users')
 *   async deleteAllUsers() {
 *     await userService.deleteAll();
 *     return { deletedCount: await userService.count() };
 *   }
 * }
 * ```
 *
 * @see RouteOptions for available configuration options
 */
export function Delete<Path extends string, const O extends RouteOptions<Path> | undefined>(
  path: Path,
  options?: O,
) {
  return createMethodDecorator('DELETE', path, options);
}
