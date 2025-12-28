import { HttpError } from './http-error.js';
import type { ValidationIssue } from '../../contracts/validator.js';

export class ValidationError extends HttpError {
  public readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(400, message, {
      code: 'VALIDATION_ERROR',
      details: { issues },
      expose: true,
    });
    this.name = 'ValidationError';
    this.issues = issues;
  }

  static fromIssues(issues: ValidationIssue[], message = 'Validation failed'): ValidationError {
    return new ValidationError(message, issues);
  }
}
