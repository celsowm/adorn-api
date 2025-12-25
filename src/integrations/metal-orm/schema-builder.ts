import { z } from 'zod';
import { named, p, q, type SchemaRef } from '../../core/schema.js';
import { getTableDefFromEntity, normalizeColumnType } from 'metal-orm';
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

export type EntityPick<T, K extends readonly (keyof T)[]> = Pick<T, K[number]>;

export function defineEntityFields<T>() {
  return <K extends readonly (keyof T)[]>(...fields: K): K => fields;
}

export function fieldsOf<T>() {
  return <K extends readonly (keyof T)[]>(...fields: K): K => fields;
}

export type EntitySchemaOverrides = Omit<CrudSchemaOverrides, 'create' | 'update'> & {
  body?: ColumnOverrides;
  create?: ColumnOverrides;
  update?: ColumnOverrides;
};

export type EntitySchemaOptions = {
  idPrefix?: string;
  entityName?: string;
  primaryKey?: string;
  overrides?: EntitySchemaOverrides;
  queryPassthrough?: boolean;
};

export type EntitySchemaView<T, K extends readonly (keyof T)[]> = {
  fields: K;
  selection: Record<string, ColumnDef>;
  responseSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  listSchema: z.ZodArray<z.ZodTypeAny>;
  response: (id?: string) => SchemaRef;
  list: (id?: string) => SchemaRef;
};

export type EntitySchemaBody<T, K extends readonly (keyof T)[]> = {
  fields: K;
  zod: () => z.ZodTypeAny;
  schema: (id?: string) => SchemaRef;
  partial: () => EntitySchemaBody<T, K>;
  array: () => EntitySchemaBody<T, K>;
  create: (id?: string) => SchemaRef;
  update: (id?: string) => SchemaRef;
};

export type EntitySchemaQuery<T, K extends readonly (keyof T)[]> = {
  fields: K;
  zod: () => z.ZodTypeAny;
  schema: (id?: string) => SchemaRef;
  passthrough: () => EntitySchemaQuery<T, K>;
  strict: () => EntitySchemaQuery<T, K>;
};

export type EntitySchemaAggregates = {
  schema: (suffix: string, schema: z.ZodTypeAny, id?: string) => SchemaRef;
  count: (id?: string) => SchemaRef;
};

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

export function parseEntityView<T extends object, K extends readonly (keyof T)[]>(
  view: EntitySchemaView<T, K>,
  input: unknown,
): EntitySelection<T, K> {
  return view.responseSchema.parse(input) as EntitySelection<T, K>;
}

export function parseEntityViewList<T extends object, K extends readonly (keyof T)[]>(
  view: EntitySchemaView<T, K>,
  input: unknown,
): Array<EntitySelection<T, K>> {
  return view.listSchema.parse(input) as Array<EntitySelection<T, K>>;
}

export function safeParseEntityView<T extends object, K extends readonly (keyof T)[]>(
  view: EntitySchemaView<T, K>,
  input: unknown,
): SafeParseResult<EntitySelection<T, K>> {
  return view.responseSchema.safeParse(input) as SafeParseResult<EntitySelection<T, K>>;
}

export function safeParseEntityViewList<T extends object, K extends readonly (keyof T)[]>(
  view: EntitySchemaView<T, K>,
  input: unknown,
): SafeParseResult<Array<EntitySelection<T, K>>> {
  return view.listSchema.safeParse(input) as SafeParseResult<Array<EntitySelection<T, K>>>;
}

export type EntitySchemas<T extends object> = {
  table: TableDef;
  entityName: string;
  idPrefix: string;
  baseId: string;
  pick: <K extends readonly (keyof T)[]>(...fields: K) => EntitySchemaView<T, K>;
  select: <K extends readonly (keyof T)[]>(...fields: K) => EntitySchemaView<T, K>;
  params: <K extends readonly (keyof T)[]>(...fields: K) => SchemaRef;
  body: <K extends readonly (keyof T)[]>(...fields: K) => EntitySchemaBody<T, K>;
  query: <K extends readonly (keyof T)[]>(...fields: K) => EntitySchemaQuery<T, K>;
  aggregates: EntitySchemaAggregates;
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

type EntityConstructor<T extends object = object> = new (...args: never[]) => T;

export function entitySchemas<T extends object>(
  target: EntityConstructor<T> | TableDef,
  options: EntitySchemaOptions = {},
): EntitySchemas<T> {
  const table = resolveTargetTable(target);
  const entityName = options.entityName ?? resolveEntityName(target, table);
  const idPrefix = options.idPrefix ?? '';
  const baseId = `${idPrefix}${entityName}`;
  const overrides = options.overrides;
  const primaryKey = options.primaryKey ?? findPrimaryKey(table);
  const queryPassthrough = options.queryPassthrough ?? true;

  const responseId = `${baseId}Response`;
  const listId = `${baseId}ListResponse`;
  const countId = `${baseId}CountResponse`;
  const paramsId = `${baseId}Params`;
  const bodyId = `${baseId}Body`;
  const createBodyId = `${idPrefix}Create${entityName}Body`;
  const updateBodyId = `${idPrefix}Update${entityName}Body`;
  const searchId = `${baseId}SearchQuery`;

  const countSchema = z.object({ count: z.number().int() });
  const aggregateSchema = (suffix: string, schema: z.ZodTypeAny, id?: string): SchemaRef =>
    named(id ?? `${baseId}${suffix}`, schema);

  const makeView = <K extends readonly (keyof T)[]>(fields: K): EntitySchemaView<T, K> => {
    const fieldNames = fields as readonly string[];
    const selection = buildColumnSelection(table, fieldNames);
    const responseSchema = buildResponseSchema(table, fieldNames, overrides);
    const listSchema = z.array(responseSchema);
    return {
      fields,
      selection,
      responseSchema,
      listSchema,
      response: (id = responseId) => named(id, responseSchema),
      list: (id = listId) => named(id, listSchema),
    };
  };

  const makeBody = <K extends readonly (keyof T)[]>(
    fields: K,
    config: { partial: boolean; array: boolean },
  ): EntitySchemaBody<T, K> => {
    const fieldNames = fields as readonly string[];
    const objectSchema = buildBodySchema(table, fieldNames, overrides, config.partial);
    const schema = config.array ? z.array(objectSchema) : objectSchema;
    return {
      fields,
      zod: () => schema,
      schema: (id = bodyId) => named(id, schema),
      create: (id = createBodyId) => named(id, schema),
      update: (id = updateBodyId) =>
        makeBody(fields, { partial: true, array: config.array }).schema(id),
      partial: () => makeBody(fields, { partial: true, array: config.array }),
      array: () => makeBody(fields, { partial: config.partial, array: true }),
    };
  };

  const makeQuery = <K extends readonly (keyof T)[]>(
    fields: K,
    passthrough: boolean,
  ): EntitySchemaQuery<T, K> => {
    const fieldNames = fields as readonly string[];
    const objectSchema = buildQuerySchema(table, fieldNames, overrides, passthrough);
    return {
      fields,
      zod: () => objectSchema,
      schema: (id = searchId) => named(id, objectSchema),
      passthrough: () => makeQuery(fields, true),
      strict: () => makeQuery(fields, false),
    };
  };

  const params = <K extends readonly (keyof T)[]>(...fields: K): SchemaRef => {
    const resolved = (fields.length ? fields : [primaryKey]) as readonly (keyof T)[];
    const fieldNames = resolved as readonly string[];
    const schema = buildParamsSchema(table, fieldNames, overrides);
    return named(paramsId, schema);
  };

  const pick = <K extends readonly (keyof T)[]>(...fields: K): EntitySchemaView<T, K> =>
    makeView(fields);
  const body = <K extends readonly (keyof T)[]>(...fields: K): EntitySchemaBody<T, K> =>
    makeBody(fields, { partial: false, array: false });
  const query = <K extends readonly (keyof T)[]>(...fields: K): EntitySchemaQuery<T, K> =>
    makeQuery(fields, queryPassthrough);
  const aggregates: EntitySchemaAggregates = {
    schema: aggregateSchema,
    count: (id = countId) => aggregateSchema('CountResponse', countSchema, id),
  };

  return {
    table,
    entityName,
    idPrefix,
    baseId,
    pick,
    select: pick,
    params,
    body,
    query,
    aggregates,
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

type EntityOverrideSlot = 'params' | 'query' | 'body' | 'response';

function resolveEntitySchema(
  slot: EntityOverrideSlot,
  field: string,
  overrides: EntitySchemaOverrides | undefined,
  fallback: () => z.ZodTypeAny,
): z.ZodTypeAny {
  let override = overrides?.[slot]?.[field] ?? overrides?.all?.[field];
  if (!override && slot === 'body') {
    override = overrides?.create?.[field] ?? overrides?.update?.[field];
  }
  return override ?? fallback();
}

function buildResponseSchema(
  table: TableDef,
  fields: readonly string[],
  overrides: EntitySchemaOverrides | undefined,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    const column = getColumn(table, field);
    const base = resolveEntitySchema('response', field, overrides, () => baseResponseSchema(column));
    shape[field] = column.notNull ? base : base.nullable();
  }
  return z.object(shape);
}

function buildBodySchema(
  table: TableDef,
  fields: readonly string[],
  overrides: EntitySchemaOverrides | undefined,
  partial: boolean,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    const column = getColumn(table, field);
    const base = resolveEntitySchema('body', field, overrides, () => baseBodySchema(column));
    if (partial) {
      shape[field] = column.notNull ? base.optional() : base.nullable().optional();
    } else {
      shape[field] = column.notNull ? base : base.optional();
    }
  }
  return z.object(shape);
}

function buildQuerySchema(
  table: TableDef,
  fields: readonly string[],
  overrides: EntitySchemaOverrides | undefined,
  passthrough: boolean,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    const column = getColumn(table, field);
    const base = resolveEntitySchema('query', field, overrides, () => baseQuerySchema(column));
    shape[field] = base.optional();
  }
  const schema = z.object(shape);
  return passthrough ? schema.passthrough() : schema;
}

function buildParamsSchema(
  table: TableDef,
  fields: readonly string[],
  overrides: EntitySchemaOverrides | undefined,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    const column = getColumn(table, field);
    shape[field] = resolveEntitySchema('params', field, overrides, () => baseParamSchema(column));
  }
  return z.object(shape);
}

function isTableDef(target: unknown): target is TableDef {
  return typeof target === 'object' && target !== null && 'columns' in target && 'name' in target;
}

function resolveTargetTable<T extends object>(target: EntityConstructor<T> | TableDef): TableDef {
  if (isTableDef(target)) return target;
  const table = getTableDefFromEntity(target);
  if (!table) {
    throw new Error(`Entity '${target.name}' is not registered with metal-orm decorators`);
  }
  return table;
}

function resolveEntityName<T extends object>(target: EntityConstructor<T> | TableDef, table: TableDef): string {
  if (!isTableDef(target)) return target.name;
  return table.name;
}

function findPrimaryKey(table: TableDef): string {
  if (Array.isArray(table.primaryKey) && table.primaryKey.length) {
    return table.primaryKey[0]!;
  }
  const pk = Object.values(table.columns).find((col) => col.primary);
  return pk?.name ?? 'id';
}
