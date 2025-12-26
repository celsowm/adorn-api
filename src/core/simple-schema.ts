import { ValidationError, type ValidationIssue } from './errors.js';

/**
 * A minimal JSON-Schema-ish format used as an alternative to Zod.
 * This is intentionally small: just enough for route validation + OpenAPI.
 *
 * Notes:
 * - Optional properties are represented via `x-adorn-optional` on property schemas,
 *   and materialized into `required` arrays by builders (e.g. schema providers).
 * - Coercions are represented via `x-adorn-coerce`.
 */
export type SimpleSchema = {
  type?: string | string[];
  anyOf?: SimpleSchema[];
  properties?: Record<string, SimpleSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: SimpleSchema;
  minLength?: number;
  format?: 'email' | 'uuid' | (string & {});
  enum?: Array<string | number | boolean | null>;
  'x-adorn-optional'?: true;
  'x-adorn-coerce'?: 'number' | 'boolean';
};

export function stripSimpleSchemaExtensions(schema: SimpleSchema): SimpleSchema {
  const { ['x-adorn-optional']: _opt, ['x-adorn-coerce']: _coerce, ...rest } = schema;
  const out: SimpleSchema = { ...rest };

  if (schema.anyOf) {
    out.anyOf = schema.anyOf.map(stripSimpleSchemaExtensions);
  }
  if (schema.items) {
    out.items = stripSimpleSchemaExtensions(schema.items);
  }
  if (schema.properties) {
    const props: Record<string, SimpleSchema> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      props[k] = stripSimpleSchemaExtensions(v);
    }
    out.properties = props;
  }

  return out;
}

export function validateSimpleSchemaOrThrow(
  schema: SimpleSchema,
  value: unknown,
  source: ValidationIssue['source'],
): unknown {
  const issues: ValidationIssue[] = [];
  const out = validate(schema, value, source, [], issues);
  if (issues.length) {
    throw new ValidationError('validation failed', issues);
  }
  return out;
}

function validate(
  schema: SimpleSchema,
  value: unknown,
  source: ValidationIssue['source'],
  path: Array<string | number>,
  issues: ValidationIssue[],
): unknown {
  // Optional at root (rare, but keep semantics)
  if (schema['x-adorn-optional'] && value === undefined) return undefined;

  // anyOf
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    const snapshots = issues.length;
    for (const option of schema.anyOf) {
      const localIssues: ValidationIssue[] = [];
      const out = validate(option, value, source, path, localIssues);
      if (!localIssues.length) return out;
    }
    issues.push({
      source,
      path,
      message: 'Invalid value',
      code: 'anyOf',
      expected: schema.anyOf.map((s) => s.type ?? 'any'),
      received: describeValue(value),
    });
    return value;
  }

  const expectedType = schema.type;
  if (!expectedType || expectedType === 'any') return value;

  if (Array.isArray(expectedType)) {
    // Treat as union of primitive/object/array/null types
    return validate({ anyOf: expectedType.map((t) => ({ ...schema, type: t, anyOf: undefined })) }, value, source, path, issues);
  }

  if (expectedType === 'null') {
    if (value !== null) {
      pushTypeIssue(issues, source, path, expectedType, value);
    }
    return value;
  }

  if (expectedType === 'string') {
    if (typeof value !== 'string') {
      pushTypeIssue(issues, source, path, expectedType, value);
      return value;
    }
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      issues.push({
        source,
        path,
        message: `String must contain at least ${schema.minLength} character(s)`,
        code: 'too_small',
        expected: { minLength: schema.minLength },
        received: value,
      });
    }
    if (schema.format === 'email' && !isEmail(value)) {
      issues.push({
        source,
        path,
        message: 'Invalid email',
        code: 'format',
        expected: 'email',
        received: value,
      });
    }
    if (schema.format === 'uuid' && !isUuid(value)) {
      issues.push({
        source,
        path,
        message: 'Invalid uuid',
        code: 'format',
        expected: 'uuid',
        received: value,
      });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      issues.push({
        source,
        path,
        message: 'Invalid enum value',
        code: 'enum',
        expected: schema.enum,
        received: value,
      });
    }
    return value;
  }

  if (expectedType === 'number' || expectedType === 'integer') {
    let n = value;
    if (schema['x-adorn-coerce'] === 'number' && typeof n === 'string') {
      const parsed = Number(n);
      n = Number.isFinite(parsed) ? parsed : n;
    }
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      pushTypeIssue(issues, source, path, expectedType, value);
      return value;
    }
    if (expectedType === 'integer' && !Number.isInteger(n)) {
      issues.push({
        source,
        path,
        message: 'Expected integer',
        code: 'invalid_type',
        expected: 'integer',
        received: n,
      });
    }
    return n;
  }

  if (expectedType === 'boolean') {
    let b = value;
    if (schema['x-adorn-coerce'] === 'boolean' && typeof b === 'string') {
      const s = b.trim().toLowerCase();
      if (['true', '1', 'on', 'yes'].includes(s)) b = true;
      if (['false', '0', 'off', 'no'].includes(s)) b = false;
    }
    if (typeof b !== 'boolean') {
      pushTypeIssue(issues, source, path, expectedType, value);
      return value;
    }
    return b;
  }

  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      pushTypeIssue(issues, source, path, expectedType, value);
      return value;
    }
    const itemSchema = schema.items ?? {};
    return value.map((item, idx) => validate(itemSchema, item, source, [...path, idx], issues));
  }

  if (expectedType === 'object') {
    if (!isPlainObject(value)) {
      pushTypeIssue(issues, source, path, expectedType, value);
      return value;
    }
    const obj = value as Record<string, unknown>;
    const props = schema.properties ?? {};
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const out: Record<string, unknown> = {};

    for (const reqKey of required) {
      if (obj[reqKey] === undefined) {
        issues.push({
          source,
          path: [...path, reqKey],
          message: 'Required',
          code: 'required',
          expected: 'present',
          received: undefined,
        });
      }
    }

    for (const [k, propSchema] of Object.entries(props)) {
      if (obj[k] === undefined) continue;
      out[k] = validate(propSchema, obj[k], source, [...path, k], issues);
    }

    // Ignore additional properties (matches Zod's default strip behavior)
    return out;
  }

  // Unknown type -> treat as any
  return value;
}

function pushTypeIssue(
  issues: ValidationIssue[],
  source: ValidationIssue['source'],
  path: Array<string | number>,
  expected: string,
  received: unknown,
): void {
  issues.push({
    source,
    path,
    message: `Expected ${expected}`,
    code: 'invalid_type',
    expected,
    received: describeValue(received),
  });
}

function describeValue(v: unknown): unknown {
  if (v === null) return null;
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isEmail(v: string): boolean {
  // Intentionally simple (good enough for tests + basic UX validation).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

