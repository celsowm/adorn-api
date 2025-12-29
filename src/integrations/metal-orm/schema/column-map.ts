import { v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import type { ValidationResult } from '../../../contracts/validator.js';
import type { ColumnDef } from 'metal-orm';

/**
 * Database column type categories for schema mapping.
 *
 * These sets categorize database column types for
 * appropriate schema generation.
 */
const INTEGER_TYPES = new Set(['int', 'integer', 'bigint']);
const DECIMAL_TYPES = new Set(['decimal', 'numeric', 'float', 'double', 'real']);
const STRING_TYPES = new Set(['char', 'text', 'enum']);
const BOOLEAN_TYPES = new Set(['boolean', 'bool']);
const DATE_TIME_TYPES = new Set(['date', 'datetime', 'timestamp', 'timestamptz', 'time', 'timetz']);
const JSON_TYPES = new Set(['json', 'jsonb']);
const BINARY_TYPES = new Set(['blob', 'binary', 'varbinary', 'bytea']);

/**
 * Helper function to create successful validation results.
 *
 * @template T - The value type
 * @param value - The validated value
 * @returns Validation result with ok: true
 */
function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

/**
 * Creates a base string schema.
 *
 * @returns Basic string validation schema
 */
function baseStringSchema(): ReturnType<typeof v.string> {
  return v.string();
}

/**
 * Creates a base number schema.
 *
 * @returns Basic number validation schema
 */
function _baseNumberSchema(): ReturnType<typeof v.number> {
  return v.number();
}

/**
 * Creates a base boolean schema.
 *
 * @returns Basic boolean validation schema
 */
function _baseBooleanSchema(): ReturnType<typeof v.boolean> {
  return v.boolean();
}

/**
 * Creates a schema that accepts any value.
 *
 * Used for JSON/BLOB columns that can contain
 * arbitrary data structures.
 *
 * @returns Schema that validates any value
 */
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

/**
 * Maps Metal-ORM column definitions to validation schemas.
 *
 * This function converts database column types to appropriate
 * validation schemas that can be used for request validation
 * and data processing.
 *
 * @param column - Metal-ORM column definition
 * @returns Validation schema appropriate for the column type
 *
 * @example
 * ```typescript
 * // Integer column
 * const intColumn = { type: 'int', notNull: true };
 * const intSchema = columnToSchema(intColumn);
 * // Returns: v.number().int()
 *
 * // UUID column
 * const uuidColumn = { type: 'uuid', notNull: false };
 * const uuidSchema = columnToSchema(uuidColumn);
 * // Returns: v.string().format('uuid')
 *
 * // DateTime column
 * const dateColumn = { type: 'timestamp', notNull: true };
 * const dateSchema = columnToSchema(dateColumn);
 * // Returns: v.string().format('date-time')
 *
 * // VARCHAR with length
 * const varcharColumn = { type: 'varchar', args: [255], notNull: true };
 * const varcharSchema = columnToSchema(varcharColumn);
 * // Returns: v.string().max(255)
 * ```
 *
 * @example
 * ```typescript
 * // Using in entity schema generation
 * import { entity } from './entity';
 * import { columnToSchema } from './column-map';
 *
 * // Custom entity schema with column mapping
 * function customEntitySchema(Entity: EntityCtor<any>) {
 *   const table = tableDefOf(Entity);
 *   const shape: Record<string, Schema<any>> = {};
 *
 *   for (const [key, column] of Object.entries(table.columns)) {
 *     const schema = columnToSchema(column);
 *     shape[key] = column.notNull ? schema : v.optional(schema);
 *   }
 *
 *   return v.object(shape);
 * }
 * ```
 *
 * @see entity for complete entity schema generation
 * @see ValidationResult for validation result structure
 */
export function columnToSchema(column: ColumnDef): Schema<unknown> {
  const rawType = String(column.type ?? '').toLowerCase();
  const normalizedType = rawType.split('(')[0].trim();

  if (INTEGER_TYPES.has(normalizedType)) {
    return v.number().int();
  }

  if (DECIMAL_TYPES.has(normalizedType)) {
    return v.number();
  }

  if (BOOLEAN_TYPES.has(normalizedType)) {
    return v.boolean();
  }

  if (normalizedType === 'uuid') {
    const schema = baseStringSchema();
    if (schema.ir.kind === 'string') {
      schema.ir.format = 'uuid';
    }
    return schema;
  }

  if (DATE_TIME_TYPES.has(normalizedType)) {
    const schema = baseStringSchema();
    if (schema.ir.kind === 'string') {
      schema.ir.format = 'date-time';
    }
    return schema;
  }

  if (normalizedType === 'varchar') {
    const schema = baseStringSchema();
    const len = typeof column.args?.[0] === 'number' ? column.args[0] as number : undefined;
    return len !== undefined ? schema.max(len) : schema;
  }

  if (STRING_TYPES.has(normalizedType)) {
    return baseStringSchema();
  }

  if (JSON_TYPES.has(normalizedType)) {
    return anySchema();
  }

  if (BINARY_TYPES.has(normalizedType)) {
    const schema = baseStringSchema();
    return schema;
  }

  if (normalizedType === 'text') {
    return baseStringSchema();
  }

  return baseStringSchema();
}

/**
 * Checks if a column is required (not nullable).
 *
 * @param column - Metal-ORM column definition
 * @returns true if column is required (notNull), false otherwise
 *
 * @example
 * ```typescript
 * // Required column
 * const requiredColumn = { type: 'string', notNull: true };
 * const isRequired = isRequiredColumn(requiredColumn); // true
 *
 * // Optional column
 * const optionalColumn = { type: 'string', notNull: false };
 * const isOptional = isRequiredColumn(optionalColumn); // false
 * ```
 *
 * @example
 * ```typescript
 * // Using in schema generation
 * function generateSchemaFromTable(table: TableDef) {
 *   const shape: Record<string, Schema<any>> = {};
 *
 *   for (const [key, column] of Object.entries(table.columns)) {
 *     const schema = columnToSchema(column);
 *     const required = isRequiredColumn(column);
 *     shape[key] = required ? schema : v.optional(schema);
 *   }
 *
 *   return v.object(shape);
 * }
 * ```
 *
 * @see columnToSchema for column type mapping
 */
export function isRequiredColumn(column: ColumnDef): boolean {
  return Boolean(column.notNull);
}
