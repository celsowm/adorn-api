export type ValidationPath = Array<string | number>;

export type ValidationIssue = {
  path: ValidationPath; // e.g. ["body", "email"] or ["query", "page"]
  message: string; // human readable
  code?: string; // e.g. "invalid_type", "too_small"
  expected?: unknown;
  received?: unknown;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Optional pluggable validator interface.
 * You can implement adapters later (zod/ajv/valibot).
 */
export interface Validator {
  validateBody<T = unknown>(body: unknown, schemaId: string): ValidationResult<T>;
  validateQuery<T = unknown>(query: unknown, schemaId: string): ValidationResult<T>;
  validateParams<T = unknown>(params: unknown, schemaId: string): ValidationResult<T>;
}
