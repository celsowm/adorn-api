import { ensureDecoratorMetadata } from '../../runtime/metadataPolyfill.js';
import { RouteConfigError } from '../../core/errors.js';
import {
  getTableDefFromEntity,
  normalizeColumnType,
  type ColumnDef,
  type TableDef,
} from 'metal-orm';

ensureDecoratorMetadata();

type EntityConstructor<T extends object = object> = new (...args: never[]) => T;
type EntityTarget<TEntity extends object = object> = EntityConstructor<TEntity> | TableDef;
type EntityField<TEntity extends object> = keyof TEntity & string;

export type LoadedItems<T = unknown> =
  | {
      getItems: () => Array<T> | null | undefined;
    }
  | null
  | undefined;

function isTableDef(target: EntityConstructor<object> | TableDef): target is TableDef {
  return typeof target === 'object' && target !== null && 'columns' in target && 'name' in target;
}

function resolveTable(target: EntityConstructor<object> | TableDef): TableDef {
  if (isTableDef(target)) return target;
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

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : undefined;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
    return undefined;
  }
  return undefined;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function coerceValueByColumn(col: ColumnDef, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  const normalized = normalizeColumnType(col.type);

  if (
    normalized === 'int' ||
    normalized === 'integer' ||
    normalized === 'bigint' ||
    normalized === 'decimal' ||
    normalized === 'float' ||
    normalized === 'double'
  ) {
    return coerceNumber(value);
  }

  if (normalized === 'boolean') {
    return coerceBoolean(value);
  }

  if (
    normalized === 'date' ||
    normalized === 'datetime' ||
    normalized === 'timestamp' ||
    normalized === 'timestamptz'
  ) {
    return coerceString(value);
  }

  if (normalized === 'json' || normalized === 'blob' || normalized === 'binary' || normalized === 'varbinary') {
    return value;
  }

  return coerceString(value);
}

export function getLoadedItems<T = unknown>(collection: LoadedItems<T>): T[] {
  if (!collection || typeof collection.getItems !== 'function') return [];
  const items = collection.getItems();
  return Array.isArray(items) ? items : [];
}

export function coerceEntityField<TEntity extends object>(
  target: EntityTarget<TEntity>,
  field: EntityField<TEntity>,
  value: unknown,
): TEntity[typeof field] | undefined {
  const table = resolveTable(target as EntityConstructor<object> | TableDef);
  const col = table.columns[field];
  if (!col) return undefined;
  return coerceValueByColumn(col, value) as TEntity[typeof field] | undefined;
}

export function coerceEntityId<TEntity extends object>(
  target: EntityTarget<TEntity>,
  value: unknown,
): ('id' extends keyof TEntity ? TEntity['id'] : unknown) | undefined {
  const table = resolveTable(target as EntityConstructor<object> | TableDef);
  const idCol = table.columns['id'];
  if (idCol) {
    return coerceValueByColumn(idCol, value) as
      | ('id' extends keyof TEntity ? TEntity['id'] : unknown)
      | undefined;
  }

  const pk = findPrimaryKey(table);
  const pkCol = table.columns[pk];
  if (!pkCol) return undefined;
  return coerceValueByColumn(pkCol, value) as
    | ('id' extends keyof TEntity ? TEntity['id'] : unknown)
    | undefined;
}

export function pickEntityRow<TEntity extends object, const K extends readonly EntityField<TEntity>[]>(
  target: EntityTarget<TEntity>,
  row: unknown,
  fields: K,
): Pick<TEntity, K[number]> | undefined {
  if (!row || typeof row !== 'object') return undefined;

  const source = row as Record<string, unknown>;
  const table = resolveTable(target as EntityConstructor<object> | TableDef);

  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const col = table.columns[field];
    if (!col) return undefined;
    const value = coerceValueByColumn(col, source[field]);
    if (value === undefined) return undefined;
    out[field] = value;
  }

  return out as Pick<TEntity, K[number]>;
}

export function extractEntityDtos<TEntity extends object, const K extends readonly EntityField<TEntity>[]>(
  target: EntityTarget<TEntity>,
  rowsOrCollection: ReadonlyArray<unknown> | LoadedItems<unknown>,
  fields: K,
): Array<Pick<TEntity, K[number]>> {
  const rows =
    rowsOrCollection &&
    typeof (rowsOrCollection as { getItems?: unknown }).getItems === 'function'
      ? getLoadedItems(rowsOrCollection as LoadedItems<unknown>)
      : Array.from(rowsOrCollection as ReadonlyArray<unknown>);
  const dtos: Array<Pick<TEntity, K[number]>> = [];

  for (const row of rows) {
    const dto = pickEntityRow(target, row, fields);
    if (dto) dtos.push(dto);
  }

  return dtos;
}
