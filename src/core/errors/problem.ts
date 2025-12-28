import type { ProblemDetails } from '../../contracts/errors';
import { HttpError } from './http-error';
import { ValidationError } from './validation-error';

export function toProblemDetails(err: unknown, instance?: string): ProblemDetails {
  if (err instanceof ValidationError) {
    return {
      type: 'about:blank',
      title: 'Validation Error',
      status: 400,
      detail: err.message,
      instance,
      code: err.code,
      issues: err.issues,
    };
  }

  if (err instanceof HttpError) {
    return {
      type: 'about:blank',
      title: err.expose ? err.message : 'Request failed',
      status: err.status,
      detail: err.expose ? err.message : undefined,
      instance,
      code: err.code,
      details: err.details,
    };
  }

  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    instance,
  };
}
