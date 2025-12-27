import {
  createEntityFromRow,
  entityRef,
  eq,
  OrmSession,
  selectFromEntity,
  type DecoratedEntityInstance,
  type TableDef,
} from 'metal-orm';
import {
  coerceEntityId,
  defineEntityFields,
  type EntityCtor,
  type EntityFieldSpec,
  type EntityFields,
  type EntityRelationSpec,
  type EntityRowLike,
} from './schema.js';

export type LoadedItems<T> = T extends { getItems(): infer I }
  ? I
  : T extends { get(): infer I }
    ? I
    : T;

export function getLoadedItems<T>(value: T): LoadedItems<T> {
  const v = value as any;
  if (v && typeof v.getItems === 'function') return v.getItems();
  if (v && typeof v.get === 'function') return v.get();
  return value as LoadedItems<T>;
}

export function pickEntityRow<TEntity extends object>(
  entity: TEntity,
  fields: EntityFields
): EntityRowLike<TEntity> {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(fields.columns)) {
    out[name] = (entity as any)[name];
  }
  return out as EntityRowLike<TEntity>;
}

export function extractEntityDtos<TEntity extends object>(
  items: TEntity | TEntity[],
  fields: EntityFields
): EntityRowLike<TEntity> | EntityRowLike<TEntity>[] {
  const toDto = (entity: TEntity): EntityRowLike<TEntity> => {
    const out: Record<string, unknown> = pickEntityRow(entity, fields);
    for (const name of Object.keys(fields.relations)) {
      const raw = (entity as any)[name];
      if (raw === undefined) continue;
      out[name] = getLoadedItems(raw);
    }
    return out as EntityRowLike<TEntity>;
  };

  return Array.isArray(items) ? items.map(toDto) : toDto(items);
}

export type MetalOrmCrudOptions<TEntity extends object> = {
  entity: EntityCtor<TEntity>;
  fields?: EntityFields<TEntity> | Record<string, EntityFieldSpec | EntityRelationSpec>;
  autoCommit?: boolean;
};

type CrudQueryOptions = {
  include?: string[];
  dto?: boolean;
};

export class MetalOrmCrudBase<TEntity extends object> {
  protected readonly entity: EntityCtor<TEntity>;
  protected readonly table: TableDef;
  protected readonly fields: EntityFields<TEntity>;
  protected readonly autoCommit: boolean;

  constructor(options: MetalOrmCrudOptions<TEntity>) {
    this.entity = options.entity;
    this.fields = defineEntityFields(options.entity, options.fields);
    this.table = this.fields.table;
    this.autoCommit = Boolean(options.autoCommit);
  }

  async list(
    session: OrmSession,
    options: CrudQueryOptions = {}
  ): Promise<DecoratedEntityInstance<TEntity>[] | EntityRowLike<TEntity>[]> {
    const qb = this.applyIncludes(selectFromEntity(this.entity), options.include);
    const items = await qb.execute(session);
    return options.dto
      ? (extractEntityDtos(items, this.fields) as EntityRowLike<TEntity>[])
      : (items as DecoratedEntityInstance<TEntity>[]);
  }

  async findById(
    session: OrmSession,
    id: unknown,
    options: CrudQueryOptions = {}
  ): Promise<DecoratedEntityInstance<TEntity> | EntityRowLike<TEntity> | null> {
    const pk = resolvePrimaryKey(this.table);
    if (!pk) throw new Error(`Entity ${this.entity.name} has no primary key`);
    const ref = entityRef(this.entity) as any;
    const column = ref?.$?.[pk] ?? ref?.[pk];
    if (!column) throw new Error(`Primary key column not found: ${pk}`);

    const qb = this.applyIncludes(selectFromEntity(this.entity), options.include);
    const [item] = await qb
      .where(eq(column, coerceEntityId(this.table, id) as any))
      .limit(1)
      .execute(session);
    if (!item) return null;
    return options.dto
      ? (extractEntityDtos(item, this.fields) as EntityRowLike<TEntity>)
      : (item as DecoratedEntityInstance<TEntity>);
  }

  async create(session: OrmSession, payload: Record<string, unknown>): Promise<DecoratedEntityInstance<TEntity>> {
    const data = this.pickWriteData(payload);
    const entity = createEntityFromRow(session, this.table, data);
    if (this.autoCommit) await session.commit();
    return entity as DecoratedEntityInstance<TEntity>;
  }

  async update(
    session: OrmSession,
    id: unknown,
    payload: Record<string, unknown>
  ): Promise<DecoratedEntityInstance<TEntity> | null> {
    const entity = (await this.findById(session, id)) as DecoratedEntityInstance<TEntity> | null;
    if (!entity) return null;
    const data = this.pickWriteData(payload);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) (entity as any)[key] = value;
    }
    if (this.autoCommit) await session.commit();
    return entity;
  }

  async remove(session: OrmSession, id: unknown): Promise<boolean> {
    const entity = (await this.findById(session, id)) as TEntity | null;
    if (!entity) return false;
    session.markRemoved(entity);
    if (this.autoCommit) await session.commit();
    return true;
  }

  protected applyIncludes<TQuery>(qb: TQuery, include?: string[]): TQuery {
    if (!include || include.length === 0) return qb;
    let builder = qb as any;
    for (const rel of include) builder = builder.include(rel as any);
    return builder as TQuery;
  }

  protected pickWriteData(payload: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(this.fields.columns)) {
      if (spec.readOnly) continue;
      if (payload[name] !== undefined) out[name] = payload[name];
    }
    return out;
  }
}

export class MetalOrmCrudController<TEntity extends object> extends MetalOrmCrudBase<TEntity> {}

function resolvePrimaryKey(table: TableDef): string | undefined {
  if (table.primaryKey?.length) return table.primaryKey[0];
  for (const [name, column] of Object.entries(table.columns)) {
    if (column.primary) return name;
  }
  return undefined;
}
