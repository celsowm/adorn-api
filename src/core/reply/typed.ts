import type { ResponsesSpec } from '../../contracts/responses.js';
import type { Reply, ReplyHeaderValue } from '../../contracts/reply.js';
import type { Schema, Infer } from '../../validation/native/schema.js';
import type { ReplyInit } from './reply.js';
import { reply as baseReply, noContent as baseNoContent } from './reply.js';
import type {
  AllowedStatus,
  BodySchemaFor,
  HeadersDefFor,
  StatusesNoBody,
  StatusesWithBody,
} from '../../contracts/response-types.js';

type HeaderValueFromSpec<H> =
  H extends { schema: infer S extends Schema<unknown> }
    ? (Exclude<Infer<S>, undefined> extends ReplyHeaderValue ? Exclude<Infer<S>, undefined> : ReplyHeaderValue)
    : ReplyHeaderValue;

type HeaderValues<H> =
  H extends Record<string, unknown>
    ? string extends keyof H
      ? Record<string, HeaderValueFromSpec<H[string]>>
      : { [K in keyof H]?: HeaderValueFromSpec<H[K]> }
    : never;

type InitFor<R extends ResponsesSpec, S extends number> =
  Omit<ReplyInit, 'headers'> & { headers?: HeaderValues<HeadersDefFor<R, S>> };

/**
 * Creates a typed reply builder function based on route responses specification.
 *
 * This function generates a reply builder that is type-safe based on the
 * ResponsesSpec provided. It ensures that only valid status codes and
 * body types can be used, providing excellent TypeScript support.
 *
 * @template R - Responses specification for the route
 * @param _responses - Responses specification object
 * @returns Typed reply builder with `reply` and `noContent` methods
 *
 * @example
 * ```typescript
 * // Define route with responses
 * const userRoute = defineRoute('/users/:id', {
 *   responses: {
 *     200: {
 *       description: 'User found',
 *       content: {
 *         'application/json': {
 *           schema: Schema.Object({
 *             id: Schema.String().format('uuid'),
 *             name: Schema.String(),
 *             email: Schema.String().format('email')
 *           })
 *         }
 *       }
 *     },
 *     404: {
 *       description: 'User not found',
 *       content: {
 *         'application/json': {
 *           schema: Schema.Object({
 *             error: Schema.String(),
 *             code: Schema.String()
 *           })
 *         }
 *       }
 *     }
 *   }
 * });
 *
 * // Use the typed reply function
 * const reply = userRoute.reply;
 *
 * // Type-safe responses
 * reply(200, { id: '123', name: 'John', email: 'john@example.com' }); // ✅ Valid
 * reply(404, { error: 'Not found', code: 'USER_NOT_FOUND' }); // ✅ Valid
 * reply(200, { error: 'Wrong' }); // ❌ Type error - wrong body type
 * reply(500, { error: 'Server error' }); // ❌ Type error - 500 not in responses
 * ```
 *
 * @example
 * ```typescript
 * // In a controller with route definition
 * const route = routeFor('/users')({
 *   responses: {
 *     201: {
 *       description: 'User created',
 *       content: {
 *         'application/json': {
 *           schema: userSchema
 *         }
 *       }
 *     },
 *     400: {
 *       description: 'Bad request',
 *       content: {
 *         'application/json': {
 *           schema: errorSchema
 *         }
 *       }
 *     }
 *   }
 * });
 *
 * class UserController {
 *   @Post('/users')
 *   async createUser(@Body() userData: CreateUserDto) {
 *     const createdUser = await userService.create(userData);
 *     return route.reply(201, createdUser); // Type-safe!
 *   }
 * }
 * ```
 *
 * @see ResponsesSpec for response specification format
 * @see defineRoute for creating route definitions
 */
export function makeReply<const R extends ResponsesSpec>(_responses: R) {
  return {
    /**
     * Creates a typed response with body content.
     *
     * Only allowed for statuses that have a body schema in `responses`.
     * Body is type-checked against that schema for complete type safety.
     *
     * @template S - Status code that must be in responses and allow body
     * @param status - HTTP status code
     * @param body - Response body (type-checked against schema)
     * @param init - Optional initialization options
     * @returns Typed Reply object
     *
     * @example
     * ```typescript
     * // With route definition
     * const reply = makeReply({
     *   200: {
     *     content: {
     *       'application/json': {
     *         schema: Schema.Object({ name: Schema.String() })
     *       }
     *     }
     *   }
     * });
     *
     * reply.reply(200, { name: 'John' }); // ✅ Valid
     * reply.reply(200, { age: 30 }); // ❌ Type error - missing name, wrong property
     * ```
     */
    reply<const S extends AllowedStatus<R> & StatusesWithBody<R>>(
      status: S,
      body: Infer<BodySchemaFor<R, S>>,
      init?: InitFor<R, S>,
    ): Reply<Infer<BodySchemaFor<R, S>>, S> {
      return baseReply(status, body, init);
    },

    /**
     * Creates a typed response without body content.
     *
     * For no-content responses (204 etc) or when you want an empty body.
     * Only allowed for status codes that don't require a body in the responses spec.
     *
     * @template S - Status code that must be in responses and not require body
     * @param status - Optional HTTP status code (uses default from responses if omitted)
     * @param init - Optional initialization options
     * @returns Typed Reply object without body
     *
     * @example
     * ```typescript
     * // With route definition
     * const reply = makeReply({
     *   204: { description: 'No content' },
     *   202: { description: 'Accepted' }
     * });
     *
     * reply.noContent(); // ✅ Uses 204 by default
     * reply.noContent(202); // ✅ Explicit 202 status
     * reply.noContent(200); // ❌ Type error - 200 not in no-content responses
     * ```
     */
    noContent<const S extends AllowedStatus<R> & (StatusesNoBody<R> | number)>(
      status?: S,
      init?: InitFor<R, S>,
    ): Reply<undefined, S> {
      const replyInit = (init ?? {}) as ReplyInit;
      return baseNoContent(status, replyInit) as Reply<undefined, S>;
    },
  };
}
