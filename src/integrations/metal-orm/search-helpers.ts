import { ensureDecoratorMetadata } from '../../runtime/metadataPolyfill.js';
import { RouteConfigError } from '../../core/errors.js';
import {
  and,
  eq,
  getTableDefFromEntity,
  type ExpressionNode,
  type TableDef,
} from 'metal-orm';
import { coerceEntityField } from './row-helpers.js';

ensureDecoratorMetadata();

type EntityConstructor<T extends object = object> = new (...args: never[]) => T;
type EntityTarget<TEntity extends object = object> = EntityConstructor<TEntity> | TableDef;
type EntityField<TEntity extends object> = keyof TEntity & string;

type SearchInput<TEntity extends object> = Partial<Record<EntityField<TEntity>, unknown>>;

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

export function buildEntitySearchCondition<
  TEntity extends object,
  const K extends readonly EntityField<TEntity>[],
>(
  target: EntityTarget<TEntity>,
  input: SearchInput<TEntity>,
  fields: K,
): ExpressionNode | undefined {
  const table = resolveTable(target as EntityConstructor<object> | TableDef);

  let condition: ExpressionNode | undefined;
  for (const field of fields) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === '') continue;

    const column = table.columns[field];
    if (!column) continue;

    const value = coerceEntityField(target, field, raw);
    if (value === undefined) continue;

    const next = eq(column, value as never);
    condition = condition ? and(condition, next) : next;
  }

  return condition;
}

