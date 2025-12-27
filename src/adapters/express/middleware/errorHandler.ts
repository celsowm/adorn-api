import type { NextFunction, Request, Response } from 'express';

type MaybeHttpError = {
  status?: number;
  statusCode?: number;
  message?: string;
  details?: unknown;
};

export function adornErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const e = err as MaybeHttpError;

  const status =
    (typeof e?.status === 'number' && e.status) ||
    (typeof e?.statusCode === 'number' && e.statusCode) ||
    500;

  const payload = {
    error: status >= 500 ? 'Internal Server Error' : (e?.message ?? 'Request failed'),
    status,
    details: e?.details,
  };

  res.status(status).json(payload);
}
