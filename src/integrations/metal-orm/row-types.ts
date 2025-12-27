import type { SelectableKeys } from 'metal-orm';
import type { LoadedItems } from './row-helpers.js';

type NonFunctionKeys<T> = {
  [K in keyof T]-?: T[K] extends (...args: unknown[]) => unknown ? never : K;
}[keyof T];

type RelationKeys<TEntity extends object> = Exclude<NonFunctionKeys<TEntity>, SelectableKeys<TEntity>> & string;

type DbScalar<T> = [Extract<T, number>] extends [never]
  ? [Extract<T, bigint>] extends [never]
    ? T
    : T | number | string
  : T | string;

type ColumnRowValue<T> = DbScalar<NonNullable<T>> | (undefined extends T ? undefined : never) | (null extends T ? null : never);

type EntityColumnRow<TEntity extends object> = {
  [K in SelectableKeys<TEntity>]: ColumnRowValue<TEntity[K]>;
};

type RelationRowValue = LoadedItems<unknown> | ReadonlyArray<unknown>;

type EntityRelationRow<TEntity extends object> = Partial<Record<RelationKeys<TEntity>, RelationRowValue>>;

export type EntityRowLike<TEntity extends object> = EntityColumnRow<TEntity> & EntityRelationRow<TEntity>;
