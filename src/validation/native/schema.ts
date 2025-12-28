import type { ValidationIssue, ValidationResult } from '../../contracts/validator';
import type { SchemaIR } from './ir';

export type Schema<T> = {
  readonly kind: string;
  readonly ir: SchemaIR;
  readonly name?: string;
  parse(value: unknown, path?: Array<string | number>): ValidationResult<T>;
};

export type Infer<S extends Schema<any>> = S extends Schema<infer T> ? T : never;

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail<T = never>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function issue(
  path: Array<string | number>,
  message: string,
  code?: string,
  expected?: unknown,
  received?: unknown,
): ValidationIssue {
  return { path, message, code, expected, received };
}

type Check<T> = (value: T, path: Array<string | number>) => ValidationIssue | null;

function withChecks<T>(base: Schema<T>, checks: Check<T>[], ir?: SchemaIR): Schema<T> {
  return {
    kind: base.kind,
    ir: ir ?? base.ir,
    name: base.name,
    parse(value: unknown, path: Array<string | number> = []) {
      const r = base.parse(value, path);
      if (!r.ok) return r;

      const issues: ValidationIssue[] = [];
      for (const chk of checks) {
        const is = chk(r.value, path);
        if (is) issues.push(is);
      }
      return issues.length ? fail(issues) : r;
    },
  };
}

function optional<T>(inner: Schema<T>): Schema<T | undefined> {
  return {
    kind: `${inner.kind}.optional`,
    ir: { kind: 'optional', inner: inner.ir },
    parse(value: unknown, path: Array<string | number> = []) {
      if (value === undefined) return ok(undefined);
      return inner.parse(value, path) as ValidationResult<T | undefined>;
    },
  };
}

function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return {
    kind: `${inner.kind}.nullable`,
    ir: { kind: 'nullable', inner: inner.ir },
    parse(value: unknown, path: Array<string | number> = []) {
      if (value === null) return ok(null);
      return inner.parse(value, path) as ValidationResult<T | null>;
    },
  };
}

function stringBase(): Schema<string> {
  return {
    kind: 'string',
    ir: { kind: 'string' },
    parse(value: unknown, path: Array<string | number> = []) {
      if (typeof value !== 'string') {
        return fail([issue(path, 'Expected string', 'invalid_type', 'string', typeof value)]);
      }
      return ok(value);
    },
  };
}

function numberBase(): Schema<number> {
  return {
    kind: 'number',
    ir: { kind: 'number' },
    parse(value: unknown, path: Array<string | number> = []) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fail([issue(path, 'Expected finite number', 'invalid_type', 'number', value)]);
      }
      return ok(value);
    },
  };
}

function booleanBase(): Schema<boolean> {
  return {
    kind: 'boolean',
    ir: { kind: 'boolean' },
    parse(value: unknown, path: Array<string | number> = []) {
      if (typeof value !== 'boolean') {
        return fail([issue(path, 'Expected boolean', 'invalid_type', 'boolean', typeof value)]);
      }
      return ok(value);
    },
  };
}

function literalBase<T extends string | number | boolean | null>(lit: T): Schema<T> {
  return {
    kind: 'literal',
    ir: { kind: 'literal', value: lit },
    parse(value: unknown, path: Array<string | number> = []) {
      if (value !== lit) {
        return fail([issue(path, `Expected literal ${JSON.stringify(lit)}`, 'invalid_literal', lit, value)]);
      }
      return ok(lit);
    },
  };
}

function enumBase<T extends readonly string[]>(values: T): Schema<T[number]> {
  const set = new Set(values);
  return {
    kind: 'enum',
    ir: { kind: 'string', enum: [...values] },
    parse(value: unknown, path: Array<string | number> = []) {
      if (typeof value !== 'string' || !set.has(value)) {
        return fail([issue(path, `Expected one of: ${values.join(', ')}`, 'invalid_enum', values, value)]);
      }
      return ok(value as T[number]);
    },
  };
}

function arrayBase<T>(item: Schema<T>): Schema<T[]> {
  return {
    kind: 'array',
    ir: { kind: 'array', items: item.ir },
    parse(value: unknown, path: Array<string | number> = []) {
      if (!Array.isArray(value)) {
        return fail([issue(path, 'Expected array', 'invalid_type', 'array', typeof value)]);
      }
      const issues: ValidationIssue[] = [];
      const out: T[] = [];

      for (let i = 0; i < value.length; i++) {
        const r = item.parse(value[i], [...path, i]);
        if (!r.ok) issues.push(...r.issues);
        else out.push(r.value);
      }
      return issues.length ? fail(issues) : ok(out);
    },
  };
}

function unwrapOptionalIr(ir: SchemaIR): SchemaIR {
  if (ir.kind === 'optional') return ir.inner;
  return ir;
}

type ObjectShape = Record<string, Schema<any>>;

function objectBase<S extends ObjectShape>(shape: S, opts?: { strict?: boolean }): Schema<{ [K in keyof S]: Infer<S[K]> }> {
  const properties: Record<string, SchemaIR> = {};
  const required: string[] = [];

  for (const [k, sch] of Object.entries(shape)) {
    properties[k] = unwrapOptionalIr(sch.ir);
    if (sch.ir.kind !== 'optional') required.push(k);
  }

  return {
    kind: 'object',
    ir: {
      kind: 'object',
      properties,
      required,
      strict: opts?.strict ? true : undefined,
    },
    parse(value: unknown, path: Array<string | number> = []) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return fail([issue(path, 'Expected object', 'invalid_type', 'object', typeof value)]);
      }

      const v = value as Record<string, unknown>;
      const issues: ValidationIssue[] = [];
      const out: Record<string, unknown> = {};

      for (const [k, sch] of Object.entries(shape)) {
        const r = sch.parse(v[k], [...path, k]);
        if (!r.ok) issues.push(...r.issues);
        else out[k] = r.value;
      }

      if (opts?.strict) {
        for (const k of Object.keys(v)) {
          if (!(k in shape)) {
            issues.push(issue([...path, k], 'Unknown key', 'unknown_key'));
          }
        }
      }

      return issues.length ? fail(issues) : ok(out as { [K in keyof S]: Infer<S[K]> });
    },
  };
}

type StringBuilder = Schema<string> & {
  min(n: number): StringBuilder;
  max(n: number): StringBuilder;
  email(): StringBuilder;
  regex(re: RegExp, message?: string): StringBuilder;
  optional(): Schema<string | undefined>;
  nullable(): Schema<string | null>;
};

function string(): StringBuilder {
  const base = stringBase();
  const build = (checks: Check<string>[], ir: SchemaIR): StringBuilder => {
    const s = withChecks(base, checks, ir) as StringBuilder;

    s.min = (n: number) =>
      build(
        [...checks, (v, p) => (v.length < n ? issue(p, `Must be at least ${n} chars`, 'too_small', n, v.length) : null)],
        { ...ir, minLength: n },
      );

    s.max = (n: number) =>
      build(
        [...checks, (v, p) => (v.length > n ? issue(p, `Must be at most ${n} chars`, 'too_big', n, v.length) : null)],
        { ...ir, maxLength: n },
      );

    s.email = () =>
      build(
        [
          ...checks,
          (v, p) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
              ? null
              : issue(p, 'Invalid email', 'invalid_email'),
        ],
        { ...ir, format: 'email' },
      );

    s.regex = (re: RegExp, message?: string) =>
      build(
        [
          ...checks,
          (v, p) => (re.test(v) ? null : issue(p, message ?? 'Invalid format', 'invalid_format', String(re), v)),
        ],
        { ...ir, pattern: re.source },
      );

    s.optional = () => optional(s);
    s.nullable = () => nullable(s);

    return s;
  };

  return build([], base.ir);
}

type NumberBuilder = Schema<number> & {
  int(): NumberBuilder;
  min(n: number): NumberBuilder;
  max(n: number): NumberBuilder;
  optional(): Schema<number | undefined>;
  nullable(): Schema<number | null>;
};

function number(): NumberBuilder {
  const base = numberBase();
  const build = (checks: Check<number>[], ir: SchemaIR): NumberBuilder => {
    const s = withChecks(base, checks, ir) as NumberBuilder;

    s.int = () =>
      build(
        [
          ...checks,
          (v, p) => (Number.isInteger(v) ? null : issue(p, 'Must be an integer', 'not_integer')),
        ],
        { ...ir, int: true },
      );

    s.min = (n: number) =>
      build(
        [...checks, (v, p) => (v < n ? issue(p, `Must be >= ${n}`, 'too_small', n, v) : null)],
        { ...ir, min: n },
      );

    s.max = (n: number) =>
      build(
        [...checks, (v, p) => (v > n ? issue(p, `Must be <= ${n}`, 'too_big', n, v) : null)],
        { ...ir, max: n },
      );

    s.optional = () => optional(s);
    s.nullable = () => nullable(s);

    return s;
  };

  return build([], base.ir);
}

type BooleanBuilder = Schema<boolean> & {
  optional(): Schema<boolean | undefined>;
  nullable(): Schema<boolean | null>;
};

function boolean(): BooleanBuilder {
  const base = booleanBase();
  const s = base as BooleanBuilder;
  s.optional = () => optional(s);
  s.nullable = () => nullable(s);
  return s;
}

type ObjectBuilder<S extends ObjectShape> = Schema<{ [K in keyof S]: Infer<S[K]> }> & {
  strict(): ObjectBuilder<S>;
  optional(): Schema<Infer<ObjectBuilder<S>> | undefined>;
  nullable(): Schema<Infer<ObjectBuilder<S>> | null>;
};

function object<S extends ObjectShape>(shape: S): ObjectBuilder<S> {
  const build = (strictMode: boolean): ObjectBuilder<S> => {
    const base = objectBase(shape, { strict: strictMode }) as ObjectBuilder<S>;
    base.strict = () => build(true);
    base.optional = () => optional(base);
    base.nullable = () => nullable(base);
    return base;
  };
  return build(false);
}

type ArrayBuilder<T> = Schema<T[]> & {
  min(n: number): ArrayBuilder<T>;
  max(n: number): ArrayBuilder<T>;
  optional(): Schema<T[] | undefined>;
  nullable(): Schema<T[] | null>;
};

function array<T>(item: Schema<T>): ArrayBuilder<T> {
  const base = arrayBase(item);
  const build = (checks: Check<T[]>[], ir: SchemaIR): ArrayBuilder<T> => {
    const a = withChecks(base, checks, ir) as ArrayBuilder<T>;
    a.min = (n: number) =>
      build(
        [...checks, (v, p) => (v.length < n ? issue(p, `Must have at least ${n} items`, 'too_small', n, v.length) : null)],
        { ...ir, minItems: n },
      );
    a.max = (n: number) =>
      build(
        [...checks, (v, p) => (v.length > n ? issue(p, `Must have at most ${n} items`, 'too_big', n, v.length) : null)],
        { ...ir, maxItems: n },
      );
    a.optional = () => optional(a);
    a.nullable = () => nullable(a);
    return a;
  };
  return build([], base.ir);
}

function named<T>(name: string, schema: Schema<T>): Schema<T> {
  return { ...schema, name };
}

export const v = {
  string,
  number,
  boolean,
  object,
  array,
  literal: literalBase,
  enum: enumBase,
  named,
};

export type { ValidationIssue, ValidationResult };
