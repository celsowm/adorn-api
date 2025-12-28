import type { NextFunction, Request, Response } from 'express';
import { toProblemDetails } from '../../../core/errors/problem.js';

export function adornErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const problem = toProblemDetails(err, req.originalUrl || req.path);

  res.status(problem.status).json(problem);
}
