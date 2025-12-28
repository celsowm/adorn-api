/**
 * Valid types for HTTP response headers.
 */
export type ReplyHeaderValue = string | number | boolean;

/**
 * Collection of HTTP response headers.
 *
 * Key-value pairs where keys are header names and values are
 * header values of valid types.
 *
 * @example
 * ```typescript
 * const headers: ReplyHeaders = {
 *   'Content-Type': 'application/json',
 *   'Cache-Control': 'no-cache',
 *   'X-Request-ID': 'abc-123-def'
 * };
 * ```
 */
export type ReplyHeaders = Record<string, ReplyHeaderValue>;

/**
 * Typed HTTP response object used by Adorn API.
 *
 * This type represents a complete HTTP response with status code,
 * body, headers, and content type. It's used throughout the framework
 * to return responses from controllers and handlers.
 *
 * @template TBody - Type of the response body
 * @template TStatus - HTTP status code (must be a number literal)
 *
 * @example
 * ```typescript
 * // Simple JSON response
 * const successResponse: Reply<User, 200> = {
 *   __adornReply: true,
 *   status: 200,
 *   body: { id: '123', name: 'John Doe' },
 *   headers: { 'Content-Type': 'application/json' }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Error response
 * const errorResponse: Reply<ErrorDetails, 404> = {
 *   __adornReply: true,
 *   status: 404,
 *   body: { error: 'Not Found', code: 'USER_NOT_FOUND' },
 *   headers: { 'Content-Type': 'application/json' }
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Response with custom headers
 * const responseWithHeaders: Reply<string, 201> = {
 *   __adornReply: true,
 *   status: 201,
 *   body: 'Resource created',
 *   headers: {
 *     'Location': '/resources/123',
 *     'X-Resource-ID': '123'
 *   },
 *   contentType: 'text/plain'
 * };
 * ```
 *
 * @see isReply for type guard function
 */
export type Reply<TBody = unknown, TStatus extends number = number> = {
  /** Brand property to identify Adorn reply objects */
  readonly __adornReply: true;
  /** HTTP status code */
  readonly status: TStatus;
  /** Response body */
  readonly body?: TBody;
  /** Response headers */
  readonly headers?: ReplyHeaders;
  /** Content type header (convenience property) */
  readonly contentType?: string;
};

/**
 * Type guard function to check if an object is an Adorn Reply.
 *
 * This function is used to safely check if an object conforms to
 * the Reply type structure.
 *
 * @param x - Object to check
 * @returns true if the object is a Reply, false otherwise
 *
 * @example
 * ```typescript
 * function handleResponse(response: unknown) {
 *   if (isReply(response)) {
 *     // TypeScript now knows response is a Reply
 *     console.log('Status:', response.status);
 *     console.log('Body:', response.body);
 *   } else {
 *     console.log('Not a reply object');
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In middleware or error handling
 * if (isReply(error)) {
 *   // It's a reply object, can be sent directly to client
 *   res.status(error.status).json(error.body);
 * } else {
 *   // Handle non-reply errors
 *   res.status(500).json({ error: 'Internal Server Error' });
 * }
 * ```
 *
 * @see Reply for the reply object type
 */
export function isReply(x: unknown): x is Reply<any, any> {
  return !!x && typeof x === 'object' && (x as any).__adornReply === true && typeof (x as any).status === 'number';
}
