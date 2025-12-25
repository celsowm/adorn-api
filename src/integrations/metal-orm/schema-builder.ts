import { z } from 'zod';
import { named, p, q, type SchemaRef } from '../../core/schema.js';
import { normalizeColumnType } from 'metal-orm';
import type { ColumnDef, TableDef } from 'metal-orm';

type ColumnOverrides = Record<string, z.ZodTypeAny>;

export type CrudSchemaOverrides = {
  all?: ColumnOverrides;
  params?: ColumnOverrides;
  query?: ColumnOverrides;
  create?: ColumnOverrides;
  update?: ColumnOverrides;
  response?: ColumnOverrides;
};

export type CrudSchemaIds = {
  params: string;
  response: string;
  list: string;
  count: string;
  createBody: string;
  updateBody: string;
  search: string;
};

export type CrudSchemaOptions = {
  ids: CrudSchemaIds;
  table: TableDef;
  primaryKey?: string;
  select: readonly string[];
  create: readonly string[];
  update: readonly string[];
  search: readonly string[];
  overrides?: CrudSchemaOverrides;
  queryPassthrough?: boolean;
};

export type CrudZodSchemas = {
  responseSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  listSchema: z.ZodArray<z.ZodTypeAny>;
  countSchema: z.ZodObject<{ count: z.ZodNumber }>;
  paramsSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  createBodySchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  updateBodySchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  searchSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  response: SchemaRef;
  list: SchemaRef;
  count: SchemaRef;
  params: SchemaRef;
  createBody: SchemaRef;
  updateBody: SchemaRef;
  search: SchemaRef;
};

type OverrideSlot = keyof CrudSchemaOverrides;

export type EntitySelection<T, K extends readonly (keyof T)[]> = {
  [P in K[number]]: Exclude<T[P], undefined>;
};

export function createCrudSchemaIds(prefix: string, entityName: string): CrudSchemaIds {
  const base = `${prefix}${entityName}`;
  return {
    response: `${base}Response`,
    list: `${base}ListResponse`,
    count: `${base}CountResponse`,
    params: `${base}Params`,
    createBody: `${prefix}Create${entityName}Body`,
    updateBody: `${prefix}Update${entityName}Body`,
    search: `${base}SearchQuery`,
  };
}

export function buildColumnSelection(
  table: TableDef,
  columns: readonly string[],
): Record<string, ColumnDef> {
  const selection: Record<string, ColumnDef> = {};
  for (const columnName of columns) {
    const column = table.columns[columnName];
    if (!column) {
      throw new Error(`Column '${columnName}' not found on table '${table.name}'`);
    }
    selection[columnName] = column;
  }
  return selection;
}

export function createMetalOrmZodSchemas(options: CrudSchemaOptions): CrudZodSchemas {
  const primaryKey = options.primaryKey ?? 'id';
  const overrides = options.overrides;
  const queryPassthrough = options.queryPassthrough ?? true;

  const paramsShape: Record<string, z.ZodTypeAny> = {};
  const pkColumn = getColumn(options.table, primaryKey);
  paramsShape[primaryKey] = resolveSchema(
    'params',
    primaryKey,
    overrides,
    () => baseParamSchema(pkColumn),
  );
  const paramsSchema = z.object(paramsShape);

  const responseShape: Record<string, z.ZodTypeAny> = {};
  for (const field of options.select) {
    const column = getColumn(options.table, field);
    const base = resolveSchema('response', field, overrides, () => baseResponseSchema(column));
    responseShape[field] = column.notNull ? base : base.nullable();
  }
  const responseSchema = z.object(responseShape);
  const listSchema = z.array(responseSchema);
  const countSchema = z.object({ count: z.number().int() });

  const createShape: Record<string, z.ZodTypeAny> = {};
  for (const field of options.create) {
    const column = getColumn(options.table, field);
    const base = resolveSchema('create', field, overrides, () => baseBodySchema(column));
    createShape[field] = column.notNull ? base : base.optional();
  }
  const createBodySchema = z.object(createShape);

  const updateShape: Record<string, z.ZodTypeAny> = {};
  for (const field of options.update) {
    const column = getColumn(options.table, field);
    const base = resolveSchema('update', field, overrides, () => baseBodySchema(column));
    updateShape[field] = column.notNull ? base.optional() : base.nullable().optional();
  }
  const updateBodySchema = z.object(updateShape);

  const searchShape: Record<string, z.ZodTypeAny> = {};
  for (const field of options.search) {
    const column = getColumn(options.table, field);
    const base = resolveSchema('query', field, overrides, () => baseQuerySchema(column));
    searchShape[field] = base.optional();
  }
  const searchSchema = queryPassthrough ? z.object(searchShape).passthrough() : z.object(searchShape);

  return {
    responseSchema,
    listSchema,
    countSchema,
    paramsSchema,
    createBodySchema,
    updateBodySchema,
    searchSchema,
    response: named(options.ids.response, responseSchema),
    list: named(options.ids.list, listSchema),
    count: named(options.ids.count, countSchema),
    params: named(options.ids.params, paramsSchema),
    createBody: named(options.ids.createBody, createBodySchema),
    updateBody: named(options.ids.updateBody, updateBodySchema),
    search: named(options.ids.search, searchSchema),
  };
}

function resolveSchema(
  slot: OverrideSlot,
  field: string,
  overrides: CrudSchemaOverrides | undefined,
  fallback: () => z.ZodTypeAny,
): z.ZodTypeAny {
  const override = overrides?.[slot]?.[field] ?? overrides?.all?.[field];
  return override ?? fallback();
}

function getColumn(table: TableDef, columnName: string): ColumnDef {
  const column = table.columns[columnName];
  if (!column) {
    throw new Error(`Column '${columnName}' not found on table '${table.name}'`);
  }
  return column;
}

function baseBodySchema(column: ColumnDef): z.ZodTypeAny {
  const normalized = normalizeColumnType(column.type);
  const schema = baseScalarSchema(normalized);
  if (column.notNull && isTextType(normalized)) {
    return (schema as z.ZodString).min(1);
  }
  return schema;
}

function baseResponseSchema(column: ColumnDef): z.ZodTypeAny {
  return baseScalarSchema(normalizeColumnType(column.type));
}

function baseQuerySchema(column: ColumnDef): z.ZodTypeAny {
  const normalized = normalizeColumnType(column.type);
  switch (normalized) {
    case 'int':
    case 'integer':
    case 'bigint':
      return q.int();
    case 'decimal':
    case 'float':
    case 'double':
      return z.coerce.number();
    case 'boolean':
      return q.boolean();
    case 'uuid':
      return z.string().uuid();
    default:
      return z.string();
  }
}

function baseParamSchema(column: ColumnDef): z.ZodTypeAny {
  const normalized = normalizeColumnType(column.type);
  switch (normalized) {
    case 'int':
    case 'integer':
    case 'bigint':
      return p.int();
    case 'decimal':
    case 'float':
    case 'double':
      return z.coerce.number();
    case 'boolean':
      return p.boolean();
    case 'uuid':
      return p.uuid();
    default:
      return z.string();
  }
}

function baseScalarSchema(normalized: string): z.ZodTypeAny {
  switch (normalized) {
    case 'int':
    case 'integer':
    case 'bigint':
      return z.number().int();
    case 'decimal':
    case 'float':
    case 'double':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'uuid':
      return z.string().uuid();
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
      return z.string();
    case 'json':
    case 'blob':
    case 'binary':
    case 'varbinary':
      return z.any();
    default:
      return z.string();
  }
}

function isTextType(normalized: string): boolean {
  return normalized === 'varchar' || normalized === 'text';
}
