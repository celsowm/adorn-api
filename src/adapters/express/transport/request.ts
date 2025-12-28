import type { Request, Response } from 'express';
import type { RequestContext } from '../../../contracts/context.js';

export function createExpressContext(req: Request, res: Response): RequestContext {
  return {
    params: (req.params ?? {}) as Record<string, string>,
    query: (req.query ?? {}) as Record<string, unknown>,
    body: (req as any).body,
    headers: req.headers as Record<string, string | string[] | undefined>,
    method: req.method,
    path: req.path,
    raw: { req, res },
  };
}
