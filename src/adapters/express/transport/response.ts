import type { Response } from 'express';

export function sendJson(res: Response, status: number, data: unknown): void {
  if (status && typeof status === 'number') res.status(status);
  res.json(data === undefined ? null : data);
}
