import type { Response } from 'express';
import type { Reply } from '../../../contracts/reply';

export function sendReply(res: Response, r: Reply<any, any>): void {
  if (r.headers) {
    for (const [k, v] of Object.entries(r.headers)) {
      res.setHeader(k, String(v));
    }
  }

  if (r.contentType) {
    res.type(r.contentType);
  }

  res.status(r.status);

  if (r.status === 204 || r.status === 304) {
    res.end();
    return;
  }

  const body = r.body;
  if (body === undefined) {
    res.end();
    return;
  }

  const ct = r.contentType?.toLowerCase();
  const isJson = !ct || ct.includes('application/json');

  if (isJson && typeof body === 'object' && body !== null) {
    res.json(body);
    return;
  }

  res.send(body as any);
}

export function sendJson(res: Response, status: number, data: unknown): void {
  res.status(status);

  if (status === 204 || status === 304) {
    res.end();
    return;
  }

  res.json(data === undefined ? null : data);
}
