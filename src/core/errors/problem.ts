import type { ProblemDetails } from '../../contracts/errors.js';
import { HttpError } from './http-error.js';
import { ValidationError } from './validation-error.js';

export function toProblemDetails(err: unknown, instance?: string): ProblemDetails {
  if (err instanceof ValidationError) {
    return {
      type: 'about:blank',
      title: 'Validation Error',
      status: 400,
      detail: err.message,
      ...(instance !== undefined ? { instance } : {}),
      ...(err.code !== undefined ? { code: err.code } : {}),
      issues: err.issues,
    };
  }

  if (err instanceof HttpError) {
    return {
      type: 'about:blank',
      title: err.expose ? err.message : 'Request failed',
      status: err.status,
      ...(err.expose ? { detail: err.message } : {}),
      ...(instance !== undefined ? { instance } : {}),
      ...(err.code !== undefined ? { code: err.code } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }

  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    ...(instance !== undefined ? { instance } : {}),
  };
}
