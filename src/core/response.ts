/**
 * Represents an HTTP response with a status code, body, and optional headers.
 */
export class HttpResponse<T = unknown> {
    constructor(
        public readonly status: number,
        public readonly body?: T,
        public readonly headers?: Record<string, string>
    ) { }
}

/**
 * Creates an OK (200) HTTP response.
 * @param body - Response body
 * @returns HTTP response instance
 */
export function ok<T>(body: T): HttpResponse<T> {
    return new HttpResponse(200, body);
}

/**
 * Creates a Created (201) HTTP response.
 * @param body - Response body
 * @returns HTTP response instance
 */
export function created<T>(body: T): HttpResponse<T> {
    return new HttpResponse(201, body);
}

/**
 * Creates a No Content (204) HTTP response.
 * @returns HTTP response instance
 */
export function noContent(): HttpResponse<void> {
    return new HttpResponse(204);
}

/**
 * Creates an Accepted (202) HTTP response.
 * @param body - Response body
 * @returns HTTP response instance
 */
export function accepted<T>(body?: T): HttpResponse<T> {
    return new HttpResponse(202, body);
}

/**
 * Type guard to check if a value is an HttpResponse.
 * @param value - Value to check
 * @returns True if the value is an HttpResponse
 */
export function isHttpResponse(value: unknown): value is HttpResponse {
    return value instanceof HttpResponse;
}

/**
 * Creates a redirect response.
 * @param url - URL to redirect to
 * @param status - Redirect status (default: 302 Found)
 * @returns HTTP response instance
 */
export function redirect(url: string, status = 302): HttpResponse<void> {
    return new HttpResponse(status, undefined, { 'Location': url });
}
