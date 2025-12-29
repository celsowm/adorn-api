import type { Validator, ValidationResult } from '../../contracts/validator.js';
import { ValidationError } from '../../core/errors/validation-error.js';
import type { Schema } from './schema.js';

type SchemaMap = Record<string, Schema<unknown>>;

export class NativeValidator implements Validator {
  private readonly bodies: SchemaMap;
  private readonly queries: SchemaMap;
  private readonly params: SchemaMap;

  constructor(opts?: { body?: SchemaMap; query?: SchemaMap; params?: SchemaMap }) {
    this.bodies = opts?.body ?? {};
    this.queries = opts?.query ?? {};
    this.params = opts?.params ?? {};
  }

  validateBody<T = unknown>(body: unknown, schemaId: string): ValidationResult<T> {
    const sch = this.bodies[schemaId];
    if (!sch) return { ok: true, value: body as T };
    return sch.parse(body, ['body']) as ValidationResult<T>;
  }

  validateQuery<T = unknown>(query: unknown, schemaId: string): ValidationResult<T> {
    const sch = this.queries[schemaId];
    if (!sch) return { ok: true, value: query as T };
    return sch.parse(query, ['query']) as ValidationResult<T>;
  }

  validateParams<T = unknown>(params: unknown, schemaId: string): ValidationResult<T> {
    const sch = this.params[schemaId];
    if (!sch) return { ok: true, value: params as T };
    return sch.parse(params, ['params']) as ValidationResult<T>;
  }

  assertBody<T = unknown>(body: unknown, schemaId: string): T {
    const r = this.validateBody<T>(body, schemaId);
    if (!r.ok) throw ValidationError.fromIssues(r.issues, 'Body validation failed');
    return r.value;
  }

  assertQuery<T = unknown>(query: unknown, schemaId: string): T {
    const r = this.validateQuery<T>(query, schemaId);
    if (!r.ok) throw ValidationError.fromIssues(r.issues, 'Query validation failed');
    return r.value;
  }

  assertParams<T = unknown>(params: unknown, schemaId: string): T {
    const r = this.validateParams<T>(params, schemaId);
    if (!r.ok) throw ValidationError.fromIssues(r.issues, 'Params validation failed');
    return r.value;
  }
}
