export type IssueSource = "params" | "query" | "body" | "response" | "include";

export type ValidationIssue = {
  source: IssueSource;
  path: Array<string | number>;
  message: string;
  code?: string;
};

export class ValidationError extends Error {
  readonly status = 400 as const;
  readonly name = "ValidationError" as const;

  constructor(
    message: string,
    public readonly issues: ValidationIssue[]
  ) {
    super(message);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      issues: this.issues
    };
  }
}

export class RouteConfigError extends Error {
  readonly status = 500 as const;
  readonly name = "RouteConfigError" as const;

  constructor(message: string) {
    super(message);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message
    };
  }
}