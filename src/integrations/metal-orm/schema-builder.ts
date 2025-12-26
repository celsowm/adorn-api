import { RouteConfigError } from '../../core/errors.js';
import type { SchemaProvider } from './schema-provider.js';
import { simpleSchemaProvider } from './schema-provider.js';
import {
  getTableDefFromEntity,
  normalizeColumnType,
  type ColumnDef,
  type TableDef,
} from 'metal-orm';

type EntityConstructor<T extends object = object> = new (...args: never[]) => T;
type EntityField<T extends object> = keyof T & string;

export type EntitySchemaOverrides<TSchema> = {
  params?: Record<string, TSchema>;
  response?: Record<string, TSchema>;
  create?: Record<string, TSchema>;
  update?: Record<string, TSchema>;
  search?: Record<string, TSchema>;
};

export type EntitySchemaExtras<TSchema> = {
  response?: Record<string, TSchema>;
  create?: Record<string, TSchema>;
  update?: Record<string, TSchema>;
  search?: Record<string, TSchema>;
};

export type EntitySchemaShapes<TSchema> = {
  params: Record<string, TSchema>;
  response: Record<string, TSchema>;
  create: Record<string, TSchema>;
  update: Record<string, TSchema>;
  search: Record<string, TSchema>;
};

export type EntitySchemaShapeOptions<TSchema = unknown, TEntity extends object = object> = {
  target: EntityConstructor<TEntity> | TableDef;
  provider?: SchemaProvider<TSchema>;
  id?: EntityField<TEntity>;
  select?: ReadonlyArray<EntityField<TEntity>>;
  create?: ReadonlyArray<EntityField<TEntity>>;
  update?: ReadonlyArray<EntityField<TEntity>>;
  search?: ReadonlyArray<EntityField<TEntity>>;
  overrides?: EntitySchemaOverrides<TSchema>;
  extras?: EntitySchemaExtras<TSchema>;
  responseOptional?: boolean;
  responseNullable?: boolean;
};

type ResponseWrapOptions = {
  optional: boolean;
  nullable: boolean;
};

function isTableDef(target: EntityConstructor<object> | TableDef): target is TableDef {
  return typeof target === 'object' && target !== null && 'columns' in target && 'name' in target;
}

function resolveTable(target: EntityConstructor<object> | TableDef): TableDef {
  if (isTableDef(target)) {
    return target;
  }
  const table = getTableDefFromEntity(target);
  if (!table) {
    throw new RouteConfigError(`Entity '${target.name}' is not registered with metal-orm decorators`);
  }
  return table;
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
  override: TSchema | undefined,
  responseWrap: ResponseWrapOptions,
): TSchema {
  let schema = override ?? baseColumnSchema(provider, col, slot);

  if (!override && slot === 'body' && col.notNull && isStringType(col)) {
    if (provider.minLength) {
      schema = provider.minLength(schema, 1);
    }
  }

  if (slot === 'params') {
    return applyParamCoercion(provider, schema, col);
  }

  if (slot === 'query') {
    schema = applyQueryCoercion(provider, schema, col);
    return provider.optional(schema);
  }

  if (slot === 'body') {
    return col.notNull ? schema : provider.optional(schema);
  }

  if (slot === 'response') {
    if (!override && !col.notNull) {
      if (responseWrap.optional && responseWrap.nullable) {
        schema = provider.optional(provider.nullable(schema));
      } else if (responseWrap.optional) {
        schema = provider.optional(schema);
      } else if (responseWrap.nullable) {
        schema = provider.nullable(schema);
      }
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
  _slot: 'params' | 'query' | 'body' | 'response',
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
        if (provider.string) {
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

export function buildEntitySchemaShapes<TSchema = unknown, TEntity extends object = object>(
  options: EntitySchemaShapeOptions<TSchema, TEntity>,
): EntitySchemaShapes<TSchema> {
  const provider = options.provider ?? (simpleSchemaProvider as unknown as SchemaProvider<TSchema>);
  const table = resolveTable(options.target);
  const primaryKey = options.id ?? findPrimaryKey(table);
  const selectColumns = options.select ?? Object.keys(table.columns);
  const createFields = options.create ?? defaultWriteFields(table, { includePrimary: false });
  const updateFields = options.update ?? defaultWriteFields(table, { includePrimary: false });
  const searchFields = options.search ?? [];
  const overrides = options.overrides ?? {};
  const extras = options.extras ?? {};
  const responseWrap = {
    optional: options.responseOptional ?? true,
    nullable: options.responseNullable ?? true,
  };

  const params: Record<string, TSchema> = {};
  const paramColumn = table.columns[primaryKey];
  if (!paramColumn) {
    throw new RouteConfigError(
      `Primary key column '${primaryKey}' not found on table '${table.name}'`,
    );
  }
  params[primaryKey] = columnSchema(provider, paramColumn, 'params', overrides.params?.[primaryKey], responseWrap);

  const response: Record<string, TSchema> = {};
  for (const colName of selectColumns) {
    const col = table.columns[colName];
    if (!col) {
      throw new RouteConfigError(`Column '${colName}' not found on table '${table.name}'`);
    }
    response[colName] = columnSchema(provider, col, 'response', overrides.response?.[colName], responseWrap);
  }

  const create: Record<string, TSchema> = {};
  for (const colName of createFields) {
    const col = table.columns[colName];
    if (!col) {
      throw new RouteConfigError(`Column '${colName}' not found on table '${table.name}'`);
    }
    create[colName] = columnSchema(provider, col, 'body', overrides.create?.[colName], responseWrap);
  }

  const update: Record<string, TSchema> = {};
  for (const colName of updateFields) {
    const col = table.columns[colName];
    if (!col) {
      throw new RouteConfigError(`Column '${colName}' not found on table '${table.name}'`);
    }
    update[colName] = columnSchema(provider, col, 'body', overrides.update?.[colName], responseWrap);
  }

  const search: Record<string, TSchema> = {};
  for (const colName of searchFields) {
    const col = table.columns[colName];
    if (!col) {
      throw new RouteConfigError(`Column '${colName}' not found on table '${table.name}'`);
    }
    search[colName] = columnSchema(provider, col, 'query', overrides.search?.[colName], responseWrap);
  }

  if (extras.response) Object.assign(response, extras.response);
  if (extras.create) Object.assign(create, extras.create);
  if (extras.update) Object.assign(update, extras.update);
  if (extras.search) Object.assign(search, extras.search);

  return {
    params,
    response,
    create,
    update,
    search,
  };
}
