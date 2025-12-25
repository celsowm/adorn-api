export type IssueSource = 'params' | 'query' | 'body' | 'response' | 'include';

export type ValidationIssue = {
  source: IssueSource;
  path: Array<string | number>;
  message: string;
  code?: string;
  expected?: unknown;
  received?: unknown;
};

export type ErrorEnvelope = {
  error: string;
  message: string;
  status: number;
  issues?: ValidationIssue[];
  details?: Record<string, unknown>;
};

export class ValidationError extends Error {
  readonly status = 400 as const;
  readonly name = 'ValidationError' as const;

  constructor(
    message: string,
    public readonly issues: ValidationIssue[]
  ) {
    super(message);
  }

  toJSON(): ErrorEnvelope {
    return {
      error: this.name,
      message: this.message,
      status: this.status,
      issues: this.issues,
    };
  }
}

export class RouteConfigError extends Error {
  readonly status = 500 as const;
  readonly name = 'RouteConfigError' as const;

  constructor(message: string) {
    super(message);
  }

  toJSON(): ErrorEnvelope {
    return {
      error: this.name,
      message: this.message,
      status: this.status,
    };
  }
}

export class HttpError extends Error {
  readonly name = 'HttpError' as const;

  constructor(
    public readonly status: number,
    public readonly error: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }

  toJSON(): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
      error: this.error,
      message: this.message,
      status: this.status,
    };
    if (this.details) {
      envelope.details = this.details;
    }
    return envelope;
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found', details?: Record<string, unknown>) {
    super(404, 'NotFound', message, details);
  }
}
