export interface HttpErrorOptions {
  status: number;
  message?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cause?: unknown;
}

export class HttpError extends Error {
  status: number;
  body?: unknown;
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

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}
