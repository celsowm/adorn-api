import type { HttpErrorLike, HttpErrorOptions } from '../../contracts/errors';

export class HttpError extends Error implements HttpErrorLike {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(status: number, message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? (status >= 400 && status < 500);
  }
}
