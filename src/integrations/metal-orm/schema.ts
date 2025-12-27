import { z } from 'zod';
import {
  and,
  bootstrapEntities,
  eq,
  getTableDefFromEntity,
  like,
  normalizeColumnType,
  or,
  type ColumnDef,
  type ExpressionNode,
  type RelationDef,
  RelationKinds,
  type TableDef,
  tableRef,
} from 'metal-orm';
import type { IncludePolicy } from '../../core/metadata.js';
import type { TypedRequestContext } from '../../core/express.js';
import type { SchemaRef } from '../../core/schema.js';
import { EmptyResponse, named } from '../../core/schema.js';
import type { SimpleSchema } from '../../core/simple-schema.js';

export type EntityCtor<TEntity extends object = object> = new (...args: never[]) => TEntity;

export type EntityRowLike<TEntity = unknown> = TEntity extends abstract new (
  ...args: never[]
) => infer R
  ? Partial<R>
  : Record<string, unknown>;

export type EntityFieldSpec = {
  schema?: z.ZodTypeAny;
  optional?: boolean;
  nullable?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
  sortable?: boolean;
};

export type EntityRelationSpec = {
  relation: true;
  schema?: z.ZodTypeAny;
};

export type EntityFields<TEntity extends object = object> = {
  entity: EntityCtor<TEntity>;
  table: TableDef;
  columns: Record<string, EntityFieldSpec>;
  relations: Record<string, EntityRelationSpec>;
};

export type EntitySchemaOverrides = {
  row?: Record<string, z.ZodTypeAny>;
  create?: Record<string, z.ZodTypeAny>;
  update?: Record<string, z.ZodTypeAny>;
};

export type EntitySchemaExtras = {
  row?: z.ZodRawShape;
  create?: z.ZodRawShape;
  update?: z.ZodRawShape;
};

export type EntitySchemaShapeOptions = {
  overrides?: EntitySchemaOverrides;
  extras?: EntitySchemaExtras;
};

export type EntitySchemaShapes = {
  row: z.ZodObject<any>;
  create: z.ZodObject<any>;
  update: z.ZodObject<any>;
};

export type SchemaProvider = <T = unknown>(id: string, schema: unknown) => SchemaRef<T>;

export type EntityApiOptions<
  TEntity extends object = object,
  TIdSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TListQuery extends z.ZodTypeAny = z.ZodTypeAny,
  TGetQuery extends z.ZodTypeAny = TListQuery,
  TCreateBody extends z.ZodTypeAny = z.ZodTypeAny,
  TUpdateBody extends z.ZodTypeAny = z.ZodTypeAny,
  TListResponse extends z.ZodTypeAny = z.ZodTypeAny,
  TItemResponse extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  fields?: EntityFields<TEntity> | Record<string, EntityFieldSpec | EntityRelationSpec>;
  idParam?: string;
  idSchema?: TIdSchema;
  include?: IncludePolicy | boolean;
  name?: string;
  listQuery?: TListQuery;
  getQuery?: TGetQuery;
  createBody?: TCreateBody;
  updateBody?: TUpdateBody;
  listResponse?: TListResponse;
  itemResponse?: TItemResponse;
  shapes?: EntitySchemaShapeOptions;
};

export type EntityApiRefsFromSchemas<
  TIdSchema extends z.ZodTypeAny,
  TListQuery extends z.ZodTypeAny,
  TGetQuery extends z.ZodTypeAny,
  TCreateBody extends z.ZodTypeAny,
  TUpdateBody extends z.ZodTypeAny,
  TListResponse extends z.ZodTypeAny,
  TItemResponse extends z.ZodTypeAny,
> = {
  list: {
    query: SchemaRef<z.infer<TListQuery>>;
    response: SchemaRef<z.infer<TListResponse>>;
  };
  get: {
    params: SchemaRef<Record<string, z.infer<TIdSchema>>>;
    query: SchemaRef<z.infer<TGetQuery>>;
    response: SchemaRef<z.infer<TItemResponse>>;
  };
  create: {
    body: SchemaRef<z.infer<TCreateBody>>;
    response: SchemaRef<z.infer<TItemResponse>>;
  };
  update: {
    params: SchemaRef<Record<string, z.infer<TIdSchema>>>;
    body: SchemaRef<z.infer<TUpdateBody>>;
    response: SchemaRef<z.infer<TItemResponse>>;
  };
  remove: {
    params: SchemaRef<Record<string, z.infer<TIdSchema>>>;
    response: SchemaRef;
  };
};

export type EntityApiRefs = EntityApiRefsFromSchemas<
  z.ZodTypeAny,
  z.ZodTypeAny,
  z.ZodTypeAny,
  z.ZodTypeAny,
  z.ZodTypeAny,
  z.ZodTypeAny,
  z.ZodTypeAny
>;

export type EntityApiTypes<TRefs extends EntityApiRefs> = {
  list: {
    query: InferApiSchema<TRefs['list']['query']>;
    response: InferApiSchema<TRefs['list']['response']>;
  };
  get: {
    params: InferApiSchema<TRefs['get']['params']>;
    query: InferApiSchema<TRefs['get']['query']>;
    response: InferApiSchema<TRefs['get']['response']>;
  };
  create: {
    body: InferApiSchema<TRefs['create']['body']>;
    response: InferApiSchema<TRefs['create']['response']>;
  };
  update: {
    params: InferApiSchema<TRefs['update']['params']>;
    body: InferApiSchema<TRefs['update']['body']>;
    response: InferApiSchema<TRefs['update']['response']>;
  };
  remove: {
    params: InferApiSchema<TRefs['remove']['params']>;
    response: InferApiSchema<TRefs['remove']['response']>;
  };
};

export type InferApiTypes<TApi extends { refs: EntityApiRefs }> = EntityApiTypes<TApi['refs']>;

export type EntityApiDto<TEntity = unknown> = EntityRowLike<TEntity>;

export type EntityApiCtx<TRefs, TKey extends keyof TRefs> = TypedRequestContext<
  TRefs[TKey] extends { params: SchemaRef } ? InferApiSchema<TRefs[TKey]['params']> : {},
  TRefs[TKey] extends { query: SchemaRef } ? InferApiSchema<TRefs[TKey]['query']> : {},
  TRefs[TKey] extends { body: SchemaRef } ? InferApiSchema<TRefs[TKey]['body']> : undefined
>;

type InferApiSchema<TRef extends SchemaRef> = TRef extends SchemaRef<infer R> ? R : never;

export function simpleSchemaProvider<T = unknown>(id: string, schema: SimpleSchema): SchemaRef<T> {
  return { provider: 'simple', id, schema } as SchemaRef<T>;
}

export function fieldsOf<TEntity extends object>(
  entity: EntityCtor<TEntity>
): { columns: string[]; relations: string[] } {
  const table = resolveEntityTable(entity);
  return {
    columns: Object.keys(table.columns),
    relations: Object.keys(table.relations),
  };
}

export function defineEntityFields<TEntity extends object>(
  entity: EntityCtor<TEntity>,
  fields?: EntityFields<TEntity> | Record<string, EntityFieldSpec | EntityRelationSpec>
): EntityFields<TEntity> {
  if (isEntityFields(fields)) return fields;

  const table = resolveEntityTable(entity);
  const columnNames = new Set(Object.keys(table.columns));
  const relationNames = new Set(Object.keys(table.relations));

  const columns: Record<string, EntityFieldSpec> = {};
  const relations: Record<string, EntityRelationSpec> = {};

  if (!fields) {
    for (const name of columnNames) columns[name] = {};
    return { entity, table, columns, relations };
  }

  for (const [name, spec] of Object.entries(fields)) {
    if (columnNames.has(name)) {
      columns[name] = { ...(spec as EntityFieldSpec) };
      continue;
    }
    if (relationNames.has(name)) {
      const relationSpec = spec as EntityRelationSpec;
      relations[name] = { relation: true, schema: relationSpec.schema };
      continue;
    }
    throw new Error(`Unknown entity field: ${name}`);
  }

  return { entity, table, columns, relations };
}

export function buildEntitySchemaShapes<TEntity extends object>(
  entityOrFields: EntityCtor<TEntity> | EntityFields<TEntity>,
  options: EntitySchemaShapeOptions = {}
): EntitySchemaShapes {
  const fields =
    typeof entityOrFields === 'function'
      ? defineEntityFields(entityOrFields, undefined)
      : entityOrFields;
  const table = fields.table;
  const overrides = options.overrides ?? {};
  const extras = options.extras ?? {};

  const rowShape: Record<string, z.ZodTypeAny> = {};
  for (const [name, spec] of Object.entries(fields.columns)) {
    const column = table.columns[name];
    if (!column) continue;
    let schema = spec.schema ?? overrides.row?.[name] ?? schemaFromColumn(column);
    if (spec.nullable || column.notNull !== true) schema = schema.nullable();
    rowShape[name] = schema;
  }

  for (const [name, spec] of Object.entries(fields.relations)) {
    const relation = table.relations[name];
    if (!relation) continue;
    rowShape[name] =
      spec.schema ??
      overrides.row?.[name] ??
      (isCollectionRelation(relation) ? z.array(z.unknown()) : z.unknown().nullable());
  }

  if (extras.row) Object.assign(rowShape, extras.row);

  const createShape: Record<string, z.ZodTypeAny> = {};
  for (const [name, spec] of Object.entries(fields.columns)) {
    if (spec.readOnly) continue;
    const column = table.columns[name];
    if (!column) continue;
    let schema = spec.schema ?? overrides.create?.[name] ?? schemaFromColumn(column);
    if (spec.nullable || column.notNull !== true) schema = schema.nullable();
    if (spec.optional || isWriteOptional(column)) schema = schema.optional();
    createShape[name] = schema;
  }
  if (extras.create) Object.assign(createShape, extras.create);

  const updateShape: Record<string, z.ZodTypeAny> = {};
  for (const [name, spec] of Object.entries(fields.columns)) {
    if (spec.readOnly) continue;
    const column = table.columns[name];
    if (!column) continue;
    let schema = spec.schema ?? overrides.update?.[name] ?? schemaFromColumn(column);
    if (spec.nullable || column.notNull !== true) schema = schema.nullable();
    updateShape[name] = schema.optional();
  }
  if (extras.update) Object.assign(updateShape, extras.update);

  return {
    row: z.object(rowShape),
    create: z.object(createShape),
    update: z.object(updateShape),
  };
}

export function defineEntityApi<
  TEntity extends object,
  TIdSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TListQuery extends z.ZodTypeAny = z.ZodTypeAny,
  TGetQuery extends z.ZodTypeAny = TListQuery,
  TCreateBody extends z.ZodTypeAny = z.ZodTypeAny,
  TUpdateBody extends z.ZodTypeAny = z.ZodTypeAny,
  TListResponse extends z.ZodTypeAny = z.ZodTypeAny,
  TItemResponse extends z.ZodTypeAny = z.ZodTypeAny,
>(
  entity: EntityCtor<TEntity>,
  options: EntityApiOptions<
    TEntity,
    TIdSchema,
    TListQuery,
    TGetQuery,
    TCreateBody,
    TUpdateBody,
    TListResponse,
    TItemResponse
  > = {}
): {
  refs: EntityApiRefsFromSchemas<
    TIdSchema,
    TListQuery,
    TGetQuery,
    TCreateBody,
    TUpdateBody,
    TListResponse,
    TItemResponse
  >;
  fields: EntityFields<TEntity>;
  shapes: EntitySchemaShapes;
  includePolicy?: IncludePolicy;
} {
  const fields = defineEntityFields(entity, options.fields);
  const shapes = buildEntitySchemaShapes(fields, options.shapes);
  const apiName = options.name ?? entity.name;

  const idParam = options.idParam ?? 'id';
  const idSchema = (options.idSchema ?? schemaForId(fields.table)) as TIdSchema;

  const paramsSchema = z.object({ [idParam]: idSchema });
  const listQuerySchema = (options.listQuery ?? z.object({}).passthrough()) as TListQuery;
  const getQuerySchema = (options.getQuery ?? listQuerySchema) as TGetQuery;

  const listResponseSchema = (options.listResponse ?? z.array(shapes.row)) as TListResponse;
  const itemResponseSchema = (options.itemResponse ?? shapes.row) as TItemResponse;
  const createBodySchema = (options.createBody ?? shapes.create) as TCreateBody;
  const updateBodySchema = (options.updateBody ?? shapes.update) as TUpdateBody;

  const refs: EntityApiRefsFromSchemas<
    TIdSchema,
    TListQuery,
    TGetQuery,
    TCreateBody,
    TUpdateBody,
    TListResponse,
    TItemResponse
  > = {
    list: {
      query: named<z.infer<TListQuery>>(`${apiName}ListQuery`, listQuerySchema),
      response: named<z.infer<TListResponse>>(`${apiName}ListResponse`, listResponseSchema),
    },
    get: {
      params: named<Record<string, z.infer<TIdSchema>>>(`${apiName}Params`, paramsSchema),
      query: named<z.infer<TGetQuery>>(`${apiName}GetQuery`, getQuerySchema),
      response: named<z.infer<TItemResponse>>(`${apiName}Response`, itemResponseSchema),
    },
    create: {
      body: named<z.infer<TCreateBody>>(`${apiName}CreateBody`, createBodySchema),
      response: named<z.infer<TItemResponse>>(`${apiName}CreateResponse`, itemResponseSchema),
    },
    update: {
      params: named<Record<string, z.infer<TIdSchema>>>(`${apiName}Params`, paramsSchema),
      body: named<z.infer<TUpdateBody>>(`${apiName}UpdateBody`, updateBodySchema),
      response: named<z.infer<TItemResponse>>(`${apiName}UpdateResponse`, itemResponseSchema),
    },
    remove: {
      params: named<Record<string, z.infer<TIdSchema>>>(`${apiName}Params`, paramsSchema),
      response: EmptyResponse,
    },
  };

  const includePolicy =
    options.include === true
      ? { allowed: Object.keys(fields.relations) }
      : options.include || undefined;

  return { refs, fields, shapes, includePolicy };
}

export function coerceEntityField(column: ColumnDef, value: unknown): unknown {
  const type = normalizeColumnType(column.type);
  const normalized = String(type).toUpperCase();
  if (value == null) return value;

  if (isNumericType(normalized)) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    return value;
  }

  if (normalized === 'BOOLEAN') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase();
      if (['true', '1', 'on', 'yes'].includes(s)) return true;
      if (['false', '0', 'off', 'no'].includes(s)) return false;
    }
    return value;
  }

  return value;
}

export function coerceEntityId(table: TableDef, value: unknown): unknown {
  const pk = resolvePrimaryKey(table);
  if (!pk) return value;
  const column = table.columns[pk];
  if (!column) return value;
  return coerceEntityField(column, value);
}

export function buildEntitySearchCondition(
  table: TableDef,
  fields: EntityFields,
  query: Record<string, unknown>
): ExpressionNode | undefined {
  const clauses: ExpressionNode[] = [];
  const ref = tableRef(table) as any;
  const searchValue = typeof query.q === 'string' ? query.q.trim() : '';

  if (searchValue) {
    const searchable = Object.entries(fields.columns).filter(([, spec]) => spec.searchable);
    const searchColumns = searchable.length
      ? searchable.map(([name]) => name)
      : Object.keys(fields.columns).filter((name) => isStringType(table.columns[name]?.type));

    const ors = searchColumns
      .map((name) => columnRef(ref, name))
      .filter(Boolean)
      .map((col) => like(col as any, `%${searchValue}%`));
    if (ors.length) clauses.push(ors.length === 1 ? ors[0] : or(...ors));
  }

  for (const [name, value] of Object.entries(query)) {
    if (name === 'q') continue;
    const column = table.columns[name];
    if (!column) continue;
    const colRef = columnRef(ref, name);
    if (!colRef) continue;
    clauses.push(eq(colRef as any, coerceEntityField(column, value) as any));
  }

  if (!clauses.length) return undefined;
  return clauses.length === 1 ? clauses[0] : and(...clauses);
}

function resolveEntityTable<TEntity extends object>(entity: EntityCtor<TEntity>): TableDef {
  let table = getTableDefFromEntity(entity);
  if (!table) {
    bootstrapEntities();
    table = getTableDefFromEntity(entity);
  }
  if (!table) throw new Error(`Entity ${entity.name} is not registered`);
  return table;
}

function isEntityFields<TEntity extends object>(
  value: EntityFields<TEntity> | Record<string, EntityFieldSpec | EntityRelationSpec> | undefined
): value is EntityFields<TEntity> {
  return Boolean(value && typeof value === 'object' && 'table' in value && 'columns' in value);
}

function isCollectionRelation(relation: RelationDef): boolean {
  return (
    relation.type === RelationKinds.HasMany ||
    relation.type === RelationKinds.BelongsToMany
  );
}

function schemaForId(table: TableDef): z.ZodTypeAny {
  const pk = resolvePrimaryKey(table);
  if (!pk) return z.string();
  const column = table.columns[pk];
  if (!column) return z.string();
  const normalized = String(normalizeColumnType(column.type)).toUpperCase();
  if (isNumericType(normalized)) return z.coerce.number().int();
  if (normalized === 'UUID') return z.string().uuid();
  return schemaFromColumn(column);
}

function schemaFromColumn(column: ColumnDef): z.ZodTypeAny {
  const normalized = String(normalizeColumnType(column.type)).toUpperCase();

  if (isNumericType(normalized)) return z.number();
  if (normalized === 'BOOLEAN') return z.boolean();
  if (normalized === 'UUID') return z.string().uuid();
  if (normalized === 'JSON') return z.unknown();

  if (normalized === 'ENUM') {
    const values = enumValuesFromArgs(column.args);
    if (values.length) return z.enum(values as [string, ...string[]]);
    return z.string();
  }

  if (normalized === 'DATE' || normalized === 'DATETIME' || normalized === 'TIMESTAMP' || normalized === 'TIMESTAMPTZ') {
    return z.string();
  }

  if (normalized === 'BINARY' || normalized === 'VARBINARY' || normalized === 'BLOB') {
    return z.unknown();
  }

  return z.string();
}

function isWriteOptional(column: ColumnDef): boolean {
  return Boolean(column.autoIncrement || column.generated || column.default !== undefined);
}

function resolvePrimaryKey(table: TableDef): string | undefined {
  if (table.primaryKey?.length) return table.primaryKey[0];
  for (const [name, column] of Object.entries(table.columns)) {
    if (column.primary) return name;
  }
  return undefined;
}

function enumValuesFromArgs(args?: unknown[]): string[] {
  if (!args) return [];
  if (args.length === 1 && Array.isArray(args[0])) {
    return (args[0] as unknown[]).filter((v) => typeof v === 'string') as string[];
  }
  return args.filter((v) => typeof v === 'string') as string[];
}

function isNumericType(type: string): boolean {
  return ['INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(type);
}

function isStringType(type: unknown): boolean {
  const normalized = String(normalizeColumnType((type ?? '') as any)).toUpperCase();
  return ['VARCHAR', 'TEXT', 'UUID'].includes(normalized);
}

function columnRef(ref: any, name: string): unknown {
  if (ref?.$ && name in ref.$) return ref.$[name];
  if (ref && name in ref) return ref[name];
  return undefined;
}
