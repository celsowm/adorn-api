/**
 * Options for creating HTTP errors.
 */
export interface HttpErrorOptions {
  /** HTTP status code */
  status: number;
  /** Error message */
  message?: string;
  /** Error response body */
  body?: unknown;
  /** Response headers */
  headers?: Record<string, string>;
  /** Original cause of the error */
  cause?: unknown;
}

/**
 * HTTP error class for representing HTTP error responses.
 */
export class HttpError extends Error {
  /** HTTP status code */
  status: number;
  /** Error response body */
  body?: unknown;
  /** Response headers */
  headers?: Record<string, string>;

  constructor(status: number, message?: string, body?: unknown, headers?: Record<string, string>);
  constructor(options: HttpErrorOptions);
  constructor(
    statusOrOptions: number | HttpErrorOptions,
    message?: string,
    body?: unknown,
    headers?: Record<string, string>
  ) {
    const normalized =
      typeof statusOrOptions === "number"
        ? { status: statusOrOptions, message, body, headers }
        : statusOrOptions;
    super(normalized.message ?? "Request failed.", { cause: normalized.cause });
    this.name = "HttpError";
    this.status = normalized.status;
    this.body = normalized.body;
    this.headers = normalized.headers;
  }
}

/**
 * Type guard for checking if a value is an HttpError.
 * @param value - Value to check
 * @returns True if the value is an HttpError
 */
export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}

/**
 * Throws a Bad Request (400) HTTP error.
 */
export function badRequest(message?: string, body?: unknown): never {
  throw new HttpError(400, message, body);
}

/**
 * Throws an Unauthorized (401) HTTP error.
 */
export function unauthorized(message?: string, body?: unknown): never {
  throw new HttpError(401, message, body);
}

/**
 * Throws a Forbidden (403) HTTP error.
 */
export function forbidden(message?: string, body?: unknown): never {
  throw new HttpError(403, message, body);
}

/**
 * Throws a Not Found (404) HTTP error.
 */
export function notFound(message?: string, body?: unknown): never {
  throw new HttpError(404, message, body);
}

/**
 * Throws an Internal Server Error (500) HTTP error.
 */
export function internalServerError(message?: string, body?: unknown): never {
  throw new HttpError(500, message, body);
}

/**
 * Throws a Conflict (409) HTTP error.
 */
export function conflict(message?: string, body?: unknown): never {
  throw new HttpError(409, message, body);
}

/**
 * Throws an Unprocessable Entity (422) HTTP error.
 */
export function unprocessableEntity(message?: string, body?: unknown): never {
  throw new HttpError(422, message, body);
}

/**
 * Throws a Too Many Requests (429) HTTP error.
 */
export function tooManyRequests(message?: string, body?: unknown): never {
  throw new HttpError(429, message, body);
}

/**
 * Throws a Service Unavailable (503) HTTP error.
 */
export function serviceUnavailable(message?: string, body?: unknown): never {
  throw new HttpError(503, message, body);
}
