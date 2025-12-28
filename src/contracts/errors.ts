export type ProblemDetails = {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [k: string]: unknown;
};

export type HttpErrorOptions = {
  code?: string;
  details?: unknown;
  expose?: boolean;
};

export interface HttpErrorLike {
  name: string;
  message: string;
  status: number;
  code?: string;
  details?: unknown;
  expose?: boolean;
}
