import type { Reply, ReplyHeaders } from '../../contracts/reply.js';

/**
 * Initialization options for creating Reply objects.
 *
 * These options allow customization of response headers and content type.
 */
export type ReplyInit = {
  /** Custom response headers */
  headers?: ReplyHeaders;
  /** Content type header (convenience property) */
  contentType?: string;
};

/**
 * Creates a typed HTTP response with body content.
 *
 * This function creates a Reply object with status code, body, and optional headers.
 * It's the primary way to create successful responses with content in Adorn API.
 *
 * @template TBody - Type of the response body
 * @template TStatus - HTTP status code (must be a number literal)
 * @param status - HTTP status code
 * @param body - Response body content
 * @param init - Optional initialization options (headers, contentType)
 * @returns Typed Reply object
 *
 * @example
 * ```typescript
 * // Simple JSON response
 * return reply(200, { message: 'Success', data: user });
 *
 * // Response with custom headers
 * return reply(201, createdUser, {
 *   headers: { 'Location': `/users/${createdUser.id}` },
 *   contentType: 'application/json'
 * });
 *
 * // Error response
 * return reply(404, { error: 'User not found', code: 'USER_NOT_FOUND' });
 * ```
 *
 * @example
 * ```typescript
 * // In a controller
 * @Get('/users/:id')
 * async getUser(id: string) {
 *   const user = await userService.findById(id);
 *   if (!user) {
 *     return reply(404, { error: 'User not found' });
 *   }
 *   return reply(200, user);
 * }
 * ```
 *
 * @see Reply for the return type structure
 * @see noContent for responses without body
 */
export function reply<TBody, const TStatus extends number>(
  status: TStatus,
  body: TBody,
  init: ReplyInit = {},
): Reply<TBody, TStatus> {
  return {
    __adornReply: true,
    status,
    ...(body !== undefined ? { body } : {}),
    ...(init.headers !== undefined ? { headers: init.headers } : {}),
    ...(init.contentType !== undefined ? { contentType: init.contentType } : {}),
  };
}

/**
 * Creates a typed HTTP response without body content.
 *
 * This function creates a Reply object for responses that don't include a body,
 * such as 204 No Content responses. It's commonly used for successful DELETE operations
 * or other operations where no response body is needed.
 *
 * @template TStatus - HTTP status code (default: 204, must be a number literal)
 * @param status - Optional HTTP status code (default: 204)
 * @param init - Optional initialization options (headers, contentType)
 * @returns Typed Reply object without body
 *
 * @example
 * ```typescript
 * // Standard 204 No Content response
 * return noContent();
 *
 * // Custom no-content status with headers
 * return noContent(202, {
 *   headers: { 'X-Request-Processed': 'true' }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // In a DELETE controller
 * @Delete('/users/:id')
 * async deleteUser(id: string) {
 *   await userService.delete(id);
 *   return noContent(); // 204 No Content
 * }
 *
 * // Custom accepted response
 * @Post('/users/bulk-delete')
 * async bulkDeleteUser(ids: string[]) {
 *   await userService.bulkDelete(ids);
 *   return noContent(202); // 202 Accepted
 * }
 * ```
 *
 * @see Reply for the return type structure
 * @see reply for responses with body content
 */
export function noContent<const TStatus extends number = 204>(
  status?: TStatus,
  init: ReplyInit = {},
): Reply<undefined, TStatus> {
  return {
    __adornReply: true,
    status: (status ?? (204 as TStatus)),
    ...(init.headers !== undefined ? { headers: init.headers } : {}),
    ...(init.contentType !== undefined ? { contentType: init.contentType } : {}),
  };
}
