import { v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import type { ValidationResult } from '../../../contracts/validator.js';
import type { ColumnDef } from 'metal-orm';

const INTEGER_TYPES = new Set(['int', 'integer', 'bigint']);
const DECIMAL_TYPES = new Set(['decimal', 'numeric', 'float', 'double', 'real']);
const STRING_TYPES = new Set(['char', 'text', 'enum']);
const BOOLEAN_TYPES = new Set(['boolean', 'bool']);
const DATE_TIME_TYPES = new Set(['date', 'datetime', 'timestamp', 'timestamptz', 'time', 'timetz']);
const JSON_TYPES = new Set(['json', 'jsonb']);
const BINARY_TYPES = new Set(['blob', 'binary', 'varbinary', 'bytea']);

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function baseStringSchema(): Schema<string> {
  return v.string();
}

function baseNumberSchema(): Schema<number> {
  return v.number();
}

function baseBooleanSchema(): Schema<boolean> {
  return v.boolean();
}

function anySchema(): Schema<unknown> {
  return {
    kind: 'object',
    name: 'json',
    ir: { kind: 'object', properties: {}, required: [], strict: false },
    parse(value: unknown): ValidationResult<unknown> {
      return ok(value);
    },
  };
}

export function columnToSchema(column: ColumnDef): Schema<unknown> {
  const rawType = String(column.type ?? '').toLowerCase();
  const normalizedType = rawType.split('(')[0].trim();

  if (INTEGER_TYPES.has(normalizedType)) {
    const schema = v.number().int();
    schema.ir.kind = 'number';
    schema.ir.int = true;
    return schema;
  }

  if (DECIMAL_TYPES.has(normalizedType)) {
    return v.number();
  }

  if (BOOLEAN_TYPES.has(normalizedType)) {
    return v.boolean();
  }

  if (normalizedType === 'uuid') {
    const schema = baseStringSchema();
    schema.ir.format = 'uuid';
    return schema;
  }

  if (DATE_TIME_TYPES.has(normalizedType)) {
    const schema = baseStringSchema();
    schema.ir.format = 'date-time';
    return schema;
  }

  if (normalizedType === 'varchar') {
    const schema = baseStringSchema();
    const len = typeof column.args?.[0] === 'number' ? column.args[0] as number : undefined;
    if (len !== undefined) {
      schema.max(len);
    }
    return schema;
  }

  if (STRING_TYPES.has(type)) {
    return baseStringSchema();
  }

  if (JSON_TYPES.has(type)) {
    return anySchema();
  }

  if (BINARY_TYPES.has(type)) {
    const schema = baseStringSchema();
    return schema;
  }

  if (type === 'text') {
    return baseStringSchema();
  }

  return baseStringSchema();
}

export function isRequiredColumn(column: ColumnDef): boolean {
  return Boolean(column.notNull);
}
