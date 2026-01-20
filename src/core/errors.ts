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
