export class HttpError extends Error {
  constructor(
    public status: number,
    public payload: Record<string, any> = { error: "HttpError" },
  ) {
    super(payload?.error ?? "HttpError");
    this.name = "HttpError";
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
