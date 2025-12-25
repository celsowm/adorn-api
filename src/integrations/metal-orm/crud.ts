import { ensureDecoratorMetadata } from '../../runtime/metadataPolyfill.js';
import { EmptyQuery, EmptyResponse, type SchemaRef } from '../../core/schema.js';
import { writeControllerMeta, pushRouteStub } from '../../core/metadata.js';
import type { RequestContext } from '../../core/express.js';
import {
  Orm,
  type OrmSession,
  type TableDef,
  type ColumnDef,
  type ExpressionNode,
  type SelectQueryBuilder,
  selectFromEntity,
  entityRef,
  selectFrom,
  tableRef,
  insertInto,
  update as updateQuery,
  deleteFrom,
  count,
  eq,
  and,
  getTableDefFromEntity,
  normalizeColumnType,
} from 'metal-orm';
import type { SchemaProvider } from './schema-provider.js';
import { zodSchemaProvider } from './schema-provider.js';

ensureDecoratorMetadata();

type EntityConstructor<T extends object = object> = new (...args: never[]) => T;

type CrudSchemaOverrides<TSchema> = {
  params?: Record<string, TSchema>;
  query?: Record<string, TSchema>;
  body?: Record<string, TSchema>;
  response?: Record<string, TSchema>;
};

export type MetalOrmCrudOptions<TSchema = unknown> = {
  basePath: string;
  tags?: string[];
  target: EntityConstructor<object> | TableDef;
  schemaProvider?: SchemaProvider<TSchema>;
  id?: string;
  select?: string[];
  create?: { fields?: string[] };
  update?: { fields?: string[] };
  search?: { fields?: string[] };
  defaults?: Record<string, () => unknown>;
  schemaOverrides?: CrudSchemaOverrides<TSchema>;
  notFoundMessage?: string;
};

type CrudTarget =
  | { kind: 'entity'; entity: EntityConstructor<object>; table: TableDef }
  | { kind: 'table'; table: TableDef };

type CrudDefinition<TSchema = unknown> = {
  target: CrudTarget;
  primaryKey: string;
  selectColumns: string[];
  createFields: string[];
  updateFields: string[];
  searchFields: string[];
  defaults: Record<string, () => unknown>;
  notFoundMessage: string;
  schemas: {
    params: SchemaRef;
    list: SchemaRef;
    count: SchemaRef;
    search: SchemaRef;
    response: SchemaRef;
    createBody: SchemaRef;
    updateBody: SchemaRef;
  };
  provider: SchemaProvider<TSchema>;
};

const CRUD_META = Symbol('adorn.metal-orm.crud');

function isTableDef(target: EntityConstructor<object> | TableDef): target is TableDef {
  return typeof target === 'object' && target !== null && 'columns' in target && 'name' in target;
}

function resolveTarget(target: EntityConstructor<object> | TableDef): CrudTarget {
  if (isTableDef(target)) {
    return { kind: 'table', table: target };
  }
  const table = getTableDefFromEntity(target);
  if (!table) {
    throw new Error(`Entity '${target.name}' is not registered with metal-orm decorators`);
  }
  return { kind: 'entity', entity: target, table };
}

function sanitizeIdPart(value: string): string {
  return value
    .replace(/^\//, '')
    .replace(/\/+/g, '.')
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function baseSchemaId(basePath: string, tableName: string): string {
  const base = sanitizeIdPart(basePath) || 'root';
  return `adorn.${base}.${sanitizeIdPart(tableName)}`;
}

function findPrimaryKey(table: TableDef): string {
  if (Array.isArray(table.primaryKey) && table.primaryKey.length) {
    return table.primaryKey[0]!;
  }
  const pk = Object.values(table.columns).find((col) => col.primary);
  return pk?.name ?? 'id';
}

function defaultWriteFields(table: TableDef, opts: { includePrimary: boolean }): string[] {
  return Object.values(table.columns)
    .filter((col) => {
      if (!opts.includePrimary && col.primary) return false;
      if (col.autoIncrement) return false;
      return true;
    })
    .map((col) => col.name);
}

function columnSchema<TSchema>(
  provider: SchemaProvider<TSchema>,
  col: ColumnDef,
  slot: 'params' | 'query' | 'body' | 'response',
  overrides?: TSchema,
): TSchema {
  let schema = overrides ?? baseColumnSchema(provider, col, slot);

  if (!overrides && slot === 'body' && col.notNull && isStringType(col)) {
    if (provider.minLength) {
      schema = provider.minLength(schema, 1);
    }
  }

  if (slot === 'params') {
    schema = applyParamCoercion(provider, schema, col);
  }

  if (slot === 'query') {
    schema = applyQueryCoercion(provider, schema, col);
    return provider.optional(schema);
  }

  if (slot === 'body') {
    return col.notNull ? schema : provider.optional(schema);
  }

  if (slot === 'response') {
    if (!col.notNull) {
      schema = provider.optional(provider.nullable(schema));
    }
    return schema;
  }

  return schema;
}

function applyParamCoercion<TSchema>(
  provider: SchemaProvider<TSchema>,
  schema: TSchema,
  col: ColumnDef,
): TSchema {
  if (isNumericType(col) && provider.coerceNumber) {
    return provider.coerceNumber(provider.int ? provider.int(schema) : schema);
  }
  if (isUuidType(col) && provider.uuid) {
    return provider.uuid(schema);
  }
  return schema;
}

function applyQueryCoercion<TSchema>(
  provider: SchemaProvider<TSchema>,
  schema: TSchema,
  col: ColumnDef,
): TSchema {
  if (isNumericType(col) && provider.coerceNumber) {
    return provider.coerceNumber(provider.int ? provider.int(schema) : schema);
  }
  return schema;
}

function baseColumnSchema<TSchema>(
  provider: SchemaProvider<TSchema>,
  col: ColumnDef,
  slot: 'params' | 'query' | 'body' | 'response',
): TSchema {
  const normalized = normalizeColumnType(col.type);
  switch (normalized) {
    case 'int':
    case 'integer':
    case 'bigint':
      return provider.number();
    case 'decimal':
    case 'float':
    case 'double':
      return provider.number();
    case 'boolean':
      return provider.boolean();
    case 'uuid':
      return provider.string();
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
      return provider.string();
    case 'json':
    case 'blob':
    case 'binary':
    case 'varbinary':
      return provider.any();
    case 'varchar':
    case 'text':
    case 'enum':
    default:
      if (normalized === 'enum' && Array.isArray(col.args) && col.args.every((v) => typeof v === 'string')) {
        const values = col.args as string[];
        if (values.length && provider.string) {
          return provider.string();
        }
      }
      return provider.string();
  }
}

function isNumericType(col: ColumnDef): boolean {
  const normalized = normalizeColumnType(col.type);
  return normalized === 'int' || normalized === 'integer' || normalized === 'bigint' || normalized === 'decimal' || normalized === 'float' || normalized === 'double';
}

function isStringType(col: ColumnDef): boolean {
  const normalized = normalizeColumnType(col.type);
  return normalized === 'varchar' || normalized === 'text' || normalized === 'uuid' || normalized === 'enum';
}

function isUuidType(col: ColumnDef): boolean {
  return normalizeColumnType(col.type) === 'uuid';
}

function buildSchemas<TSchema>(
  options: MetalOrmCrudOptions<TSchema>,
  target: CrudTarget,
  primaryKey: string,
  selectColumns: string[],
  createFields: string[],
  updateFields: string[],
  searchFields: string[],
  provider: SchemaProvider<TSchema>,
): CrudDefinition<TSchema>['schemas'] {
  const baseId = baseSchemaId(options.basePath, target.table.name);
  const overrides = options.schemaOverrides ?? {};

  const paramsShape: Record<string, TSchema> = {};
  const paramColumn = target.table.columns[primaryKey];
  if (!paramColumn) {
    throw new Error(`Primary key column '${primaryKey}' not found on table '${target.table.name}'`);
  }
  paramsShape[primaryKey] = columnSchema(provider, paramColumn, 'params', overrides.params?.[primaryKey]);

  const responseShape: Record<string, TSchema> = {};
  for (const colName of selectColumns) {
    const col = target.table.columns[colName];
    if (!col) {
      throw new Error(`Column '${colName}' not found on table '${target.table.name}'`);
    }
    responseShape[colName] = columnSchema(provider, col, 'response', overrides.response?.[colName]);
  }

  const createShape: Record<string, TSchema> = {};
  for (const colName of createFields) {
    const col = target.table.columns[colName];
    if (!col) {
      throw new Error(`Column '${colName}' not found on table '${target.table.name}'`);
    }
    createShape[colName] = columnSchema(provider, col, 'body', overrides.body?.[colName]);
  }

  const updateShape: Record<string, TSchema> = {};
  for (const colName of updateFields) {
    const col = target.table.columns[colName];
    if (!col) {
      throw new Error(`Column '${colName}' not found on table '${target.table.name}'`);
    }
    updateShape[colName] = columnSchema(provider, col, 'body', overrides.body?.[colName]);
  }

  const searchShape: Record<string, TSchema> = {};
  for (const colName of searchFields) {
    const col = target.table.columns[colName];
    if (!col) {
      throw new Error(`Column '${colName}' not found on table '${target.table.name}'`);
    }
    searchShape[colName] = columnSchema(provider, col, 'query', overrides.query?.[colName]);
  }

  const paramsRef = provider.toSchemaRef(`${baseId}.params`, provider.object(paramsShape));
  const responseSchema = provider.object(responseShape);
  const responseRef = provider.toSchemaRef(`${baseId}.response`, responseSchema);
  const listRef = provider.toSchemaRef(`${baseId}.list`, provider.array(responseSchema));
  const countSchema = provider.int ? provider.int(provider.number()) : provider.number();
  const countRef = provider.toSchemaRef(`${baseId}.count`, provider.object({ count: countSchema }));
  const createRef = provider.toSchemaRef(`${baseId}.create`, provider.object(createShape));
  const updateRef = provider.toSchemaRef(`${baseId}.update`, provider.object(updateShape));
  const searchRef = provider.toSchemaRef(`${baseId}.search`, provider.object(searchShape));

  return {
    params: paramsRef,
    response: responseRef,
    list: listRef,
    count: countRef,
    createBody: createRef,
    updateBody: updateRef,
    search: searchRef,
  };
}

function createCrudDefinition<TSchema>(options: MetalOrmCrudOptions<TSchema>): CrudDefinition<TSchema> {
  const provider = (options.schemaProvider ?? zodSchemaProvider) as SchemaProvider<TSchema>;
  const target = resolveTarget(options.target);
  const primaryKey = options.id ?? findPrimaryKey(target.table);
  const selectColumns = options.select ?? Object.keys(target.table.columns);
  const createFields = options.create?.fields ?? defaultWriteFields(target.table, { includePrimary: false });
  const updateFields = options.update?.fields ?? defaultWriteFields(target.table, { includePrimary: false });
  const searchFields = options.search?.fields ?? [];
  const defaults = options.defaults ?? {};
  const notFoundMessage = options.notFoundMessage ?? 'Not found';

  const schemas = buildSchemas(
    options,
    target,
    primaryKey,
    selectColumns,
    createFields,
    updateFields,
    searchFields,
    provider,
  );

  return {
    target,
    primaryKey,
    selectColumns,
    createFields,
    updateFields,
    searchFields,
    defaults,
    notFoundMessage,
    schemas,
    provider,
  };
}

function setCrudMetadata<TSchema>(ctor: Function, def: CrudDefinition<TSchema>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctor as any)[CRUD_META] = def;
}

function getCrudMetadata<TSchema>(ctor: Function): CrudDefinition<TSchema> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (ctor as any)[CRUD_META] as CrudDefinition<TSchema> | undefined;
  if (!def) {
    throw new Error('Missing metal-orm CRUD metadata. Did you forget @MetalOrmCrudController()?');
  }
  return def;
}

export function MetalOrmCrudController<TSchema = unknown>(
  options: MetalOrmCrudOptions<TSchema>,
): <T extends Function>(value: T, context: ClassDecoratorContext) => T {
  return function <T extends Function>(value: T, context: ClassDecoratorContext): T {
    const def = createCrudDefinition(options);
    setCrudMetadata(value, def);

    writeControllerMeta(context.metadata, { basePath: options.basePath, tags: options.tags ?? [] });

    pushRouteStub(context.metadata, {
      method: 'GET',
      path: '/',
      handlerName: 'list',
      schemas: { query: EmptyQuery, response: def.schemas.list },
    });

    pushRouteStub(context.metadata, {
      method: 'GET',
      path: '/count',
      handlerName: 'count',
      schemas: { query: EmptyQuery, response: def.schemas.count },
    });

    pushRouteStub(context.metadata, {
      method: 'GET',
      path: '/search',
      handlerName: 'search',
      schemas: { query: def.schemas.search, response: def.schemas.list },
    });

    pushRouteStub(context.metadata, {
      method: 'GET',
      path: `/{${def.primaryKey}}`,
      handlerName: 'get',
      schemas: { params: def.schemas.params, query: EmptyQuery, response: def.schemas.response },
    });

    pushRouteStub(context.metadata, {
      method: 'POST',
      path: '/',
      handlerName: 'create',
      schemas: { query: EmptyQuery, body: def.schemas.createBody, response: def.schemas.response },
    });

    pushRouteStub(context.metadata, {
      method: 'PUT',
      path: `/{${def.primaryKey}}`,
      handlerName: 'update',
      schemas: { params: def.schemas.params, query: EmptyQuery, body: def.schemas.updateBody, response: def.schemas.response },
    });

    pushRouteStub(context.metadata, {
      method: 'DELETE',
      path: `/{${def.primaryKey}}`,
      handlerName: 'remove',
      schemas: { params: def.schemas.params, query: EmptyQuery, response: EmptyResponse },
    });

    return value;
  };
}

type QueryResultRow = Record<string, unknown>;

function queryResultsToRows(results: Array<{ columns: string[]; values: unknown[][] }>): QueryResultRow[] {
  const rows: QueryResultRow[] = [];
  for (const result of results) {
    const { columns, values } = result;
    for (const row of values) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i += 1) {
        obj[columns[i]!] = row[i];
      }
      rows.push(obj);
    }
  }
  return rows;
}

function normalizeRow(def: CrudDefinition, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const columns = def.target.table.columns;
  for (const colName of def.selectColumns) {
    const col = columns[colName];
    if (!col) continue;
    const value = row[colName];
    if (value === undefined || value === null) {
      out[colName] = col.notNull ? value ?? null : null;
      continue;
    }

    const normalized = normalizeColumnType(col.type);
    switch (normalized) {
      case 'int':
      case 'integer':
      case 'bigint':
      case 'decimal':
      case 'float':
      case 'double': {
      out[colName] = typeof value === 'number' ? value : Number(value);
      break;
      }
      case 'boolean': {
        if (typeof value === 'boolean') {
          out[colName] = value;
        } else if (typeof value === 'number') {
          out[colName] = value !== 0;
        } else if (typeof value === 'string') {
          const v = value.trim().toLowerCase();
          out[colName] = v === 'true' || v === '1';
        } else {
          out[colName] = value;
        }
        break;
      }
      case 'date':
      case 'datetime':
      case 'timestamp':
      case 'timestamptz': {
        if (value instanceof Date) {
          out[colName] = value.toISOString();
        } else {
          out[colName] = value;
        }
        break;
      }
      default:
      out[colName] = value;
    }
  }
  return out;
}

function buildColumnSelection(table: TableDef, columns: string[]): Record<string, ColumnDef> {
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

function getColumnRef(ref: { $?: Record<string, ColumnDef> }, name: string): ColumnDef {
  if (ref.$ && ref.$[name]) return ref.$[name] as ColumnDef;
  const direct = (ref as Record<string, unknown>)[name];
  return direct as ColumnDef;
}

async function executeCompiled(session: OrmSession, compiled: { sql: string; params?: unknown[] }): Promise<QueryResultRow[]> {
  const results = await session.executor.executeSql(compiled.sql, compiled.params ?? []);
  return queryResultsToRows(results);
}

function applySearchFilters<TTable extends TableDef>(
  query: SelectQueryBuilder<unknown, TTable>,
  ref: { $?: Record<string, ColumnDef> },
  fields: string[],
  input: Record<string, unknown>,
): SelectQueryBuilder<unknown, TTable> {
  let condition: ExpressionNode | undefined;
  for (const field of fields) {
    const value = input[field];
    if (value === undefined || value === null || value === '') continue;
    const col = getColumnRef(ref, field);
    const next = eq(col, value as string | number | boolean);
    condition = condition ? and(condition, next) : next;
  }
  return condition ? query.where(condition) : query;
}

export abstract class MetalOrmCrudBase {
  protected abstract readonly orm: Orm;
  protected readonly ready: Promise<void> = Promise.resolve();

  protected createSession(): OrmSession {
    return this.orm.createSession();
  }

  protected async withSession<T>(fn: (session: OrmSession) => Promise<T>): Promise<T> {
    const session = this.createSession();
    try {
      return await fn(session);
    } finally {
      await session.dispose();
    }
  }

  async list(_ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    return this.withSession(async (session) => {
      const { selectColumns } = def;
      const columnSelection = buildColumnSelection(def.target.table, selectColumns);
      if (def.target.kind === 'entity') {
        const ref = entityRef(def.target.entity);
        const rows = await selectFromEntity(def.target.entity)
          .select(columnSelection)
          .orderBy(getColumnRef(ref, def.primaryKey), 'ASC')
          .execute(session);
        return rows.map((row) => normalizeRow(def, row as Record<string, unknown>));
      }
      const ref = tableRef(def.target.table);
      const query = selectFrom(def.target.table)
        .select(columnSelection)
        .orderBy(getColumnRef(ref, def.primaryKey), 'ASC');
      const compiled = query.compile(session.dialect);
      const rows = await executeCompiled(session, compiled);
      return rows.map((row) => normalizeRow(def, row));
    });
  }

  async count(_ctx: RequestContext): Promise<{ count: number }> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    return this.withSession(async (session) => {
      const ref = def.target.kind === 'entity'
        ? entityRef(def.target.entity)
        : tableRef(def.target.table);
      const query = (def.target.kind === 'entity'
        ? selectFromEntity(def.target.entity)
        : selectFrom(def.target.table))
        .select({ count: count(getColumnRef(ref, def.primaryKey)) });
      const compiled = query.compile(session.dialect);
      const rows = await executeCompiled(session, compiled);
      const value = rows[0]?.count;
      return { count: typeof value === 'number' ? value : Number(value ?? 0) };
    });
  }

  async search(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    const input = ctx.input.query as Record<string, unknown>;
    return this.withSession(async (session) => {
      const { selectColumns } = def;
      const columnSelection = buildColumnSelection(def.target.table, selectColumns);
      if (def.target.kind === 'entity') {
        const ref = entityRef(def.target.entity);
        let query = selectFromEntity(def.target.entity).select(columnSelection);
        query = applySearchFilters(query, ref, def.searchFields, input);
        const rows = await query.execute(session);
        return rows.map((row) => normalizeRow(def, row as Record<string, unknown>));
      }
      const ref = tableRef(def.target.table);
      let query = selectFrom(def.target.table).select(columnSelection);
      query = applySearchFilters(query, ref, def.searchFields, input);
      const compiled = query.compile(session.dialect);
      const rows = await executeCompiled(session, compiled);
      return rows.map((row) => normalizeRow(def, row));
    });
  }

  async get(ctx: RequestContext): Promise<Record<string, unknown>> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    const params = ctx.input.params as Record<string, unknown>;
    const id = params[def.primaryKey];
    return this.withSession(async (session) => {
      if (def.target.kind === 'entity') {
        const entity = await session.find(def.target.entity, id);
        if (!entity) {
          throw new Error(def.notFoundMessage);
        }
        return normalizeRow(def, entity as Record<string, unknown>);
      }
      const ref = tableRef(def.target.table);
      const query = selectFrom(def.target.table)
        .select(...def.selectColumns)
        .where(eq(getColumnRef(ref, def.primaryKey), id as string | number))
        .limit(1);
      const compiled = query.compile(session.dialect);
      const rows = await executeCompiled(session, compiled);
      const row = rows[0];
      if (!row) {
        throw new Error(def.notFoundMessage);
      }
      return normalizeRow(def, row);
    });
  }

  async create(ctx: RequestContext): Promise<Record<string, unknown>> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    const input = ctx.input.body as Record<string, unknown>;
    return this.withSession(async (session) => {
      const payload: Record<string, unknown> = { ...input };
      for (const [key, factory] of Object.entries(def.defaults)) {
        if (payload[key] === undefined) payload[key] = factory();
      }
      for (const field of def.createFields) {
        if (payload[field] !== undefined) continue;
        const col = def.target.table.columns[field];
        if (col && !col.notNull) {
          payload[field] = null;
        }
      }

      if (def.target.kind === 'entity') {
        const entity = new def.target.entity();
        for (const field of Object.keys(payload)) {
          (entity as Record<string, unknown>)[field] = payload[field];
        }
        await session.persist(entity);
        await session.commit();
        return normalizeRow(def, entity as Record<string, unknown>);
      }

      const returningColumns = def.selectColumns.map((col) => def.target.table.columns[col]).filter(Boolean);
      const stmt = insertInto(def.target.table)
        .values(payload)
        .returning(...returningColumns)
        .compile(session.dialect);
      const rows = await executeCompiled(session, stmt);
      const row = rows[0];
      if (!row) {
        throw new Error('Failed to create');
      }
      return normalizeRow(def, row);
    });
  }

  async update(ctx: RequestContext): Promise<Record<string, unknown>> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    const params = ctx.input.params as Record<string, unknown>;
    const id = params[def.primaryKey];
    const input = ctx.input.body as Record<string, unknown>;
    return this.withSession(async (session) => {
      const payload: Record<string, unknown> = {};
      for (const field of def.updateFields) {
        if (input[field] !== undefined) {
          payload[field] = input[field];
        }
      }

      if (def.target.kind === 'entity') {
        const entity = await session.find(def.target.entity, id);
        if (!entity) {
          throw new Error(def.notFoundMessage);
        }
        for (const [key, value] of Object.entries(payload)) {
          (entity as Record<string, unknown>)[key] = value;
        }
        await session.commit();
        return normalizeRow(def, entity as Record<string, unknown>);
      }

      const ref = tableRef(def.target.table);
      const returningColumns = def.selectColumns.map((col) => def.target.table.columns[col]).filter(Boolean);
      const stmt = updateQuery(def.target.table)
        .set(payload)
        .where(eq(getColumnRef(ref, def.primaryKey), id as string | number))
        .returning(...returningColumns)
        .compile(session.dialect);
      const rows = await executeCompiled(session, stmt);
      const row = rows[0];
      if (!row) {
        throw new Error(def.notFoundMessage);
      }
      return normalizeRow(def, row);
    });
  }

  async remove(ctx: RequestContext): Promise<void> {
    const def = getCrudMetadata(this.constructor as Function);
    await this.ready;
    const params = ctx.input.params as Record<string, unknown>;
    const id = params[def.primaryKey];
    await this.withSession(async (session) => {
      if (def.target.kind === 'entity') {
        const entity = await session.find(def.target.entity, id);
        if (!entity) {
          throw new Error(def.notFoundMessage);
        }
        await session.remove(entity);
        await session.commit();
        return;
      }

      const ref = tableRef(def.target.table);
      const existsQuery = selectFrom(def.target.table)
        .select(def.primaryKey)
        .where(eq(getColumnRef(ref, def.primaryKey), id as string | number))
        .limit(1)
        .compile(session.dialect);
      const existsRows = await executeCompiled(session, existsQuery);
      if (!existsRows[0]) {
        throw new Error(def.notFoundMessage);
      }
      const del = deleteFrom(def.target.table)
        .where(eq(getColumnRef(ref, def.primaryKey), id as string | number))
        .compile(session.dialect);
      await executeCompiled(session, del);
    });
  }
}
