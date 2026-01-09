export class HttpError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError;
