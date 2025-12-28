import type { ErrorRequestHandler, Request, Response } from 'express';
import type { ProblemDetails } from '../../../contracts/errors.js';
import { toProblemDetails } from '../../../core/errors/problem.js';

export type AdornErrorHandlerContext = {
  req: Request;
  res: Response;
  instance: string;
  defaultProblem: ProblemDetails;
};

export type AdornErrorHandlerResult =
  | ProblemDetails
  | {
      status: number;
      body: unknown;
      headers?: Record<string, string>;
    }
  | void;

export type AdornErrorHandlerOptions = {
  onError?: (err: unknown, ctx: AdornErrorHandlerContext) => AdornErrorHandlerResult;
};

const defaultErrorHandler = createAdornExpressErrorHandler();

export function adornErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: Parameters<ErrorRequestHandler>[3],
) {
  return defaultErrorHandler(err, req, res, next);
}

export function createAdornExpressErrorHandler(
  options: AdornErrorHandlerOptions = {},
): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const instance = req.originalUrl || req.path;
    const defaultProblem = toProblemDetails(err, instance);

    const result = options.onError?.(err, {
      req,
      res,
      instance,
      defaultProblem,
    });

    if (res.headersSent) return;

    if (result && isCustomErrorResponse(result)) {
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
      }
      res.status(result.status).json(result.body);
      return;
    }

    if (result) {
      res.status(result.status).json(result);
      return;
    }

    res.status(defaultProblem.status).json(defaultProblem);
  };
}

function isCustomErrorResponse(value: AdornErrorHandlerResult): value is {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
} {
  return !!value && typeof value === 'object' && 'body' in value;
}
