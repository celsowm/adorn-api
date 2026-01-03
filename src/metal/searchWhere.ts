import type {
  BelongsToReference,
  HasManyCollection,
  HasOneReference,
  ManyToManyCollection,
  SelectableKeys,
} from "metal-orm";

export type SearchWhereDepth = 0 | 1 | 2 | 3 | 4 | 5;

type PrevDepth = [0, 0, 1, 2, 3, 4];

type RelationWrapper =
  | HasManyCollection<any>
  | ManyToManyCollection<any, any>
  | HasOneReference<any>
  | BelongsToReference<any>;

type RelationKeys<TEntity extends object> = {
  [K in keyof TEntity & string]-?: NonNullable<TEntity[K]> extends RelationWrapper ? K : never;
}[keyof TEntity & string];

type RelationTarget<T> = T extends HasManyCollection<infer C extends object>
  ? C
  : T extends ManyToManyCollection<infer C extends object, any>
    ? C
  : T extends HasOneReference<infer C extends object>
    ? C
      : T extends BelongsToReference<infer C extends object>
        ? C
        : never;

type ScalarKeys<TEntity extends object> = SelectableKeys<TEntity> & keyof TEntity & string;

type AfterPrefix<Key extends string, Paths> = Paths extends `${Key}.${infer Rest}` ? Rest : never;

type IsWhitelistAll<IncludePaths> = [IncludePaths] extends [never]
  ? true
  : "*" extends IncludePaths
    ? true
    : false;

type IsExcludeAll<ExcludePaths> = "*" extends ExcludePaths ? true : false;

type HasDescendantPath<Key extends string, Paths> = [Extract<Paths, `${Key}.${string}`>] extends [never]
  ? false
  : true;

type IsScalarAllowed<Key extends string, IncludePaths, ExcludePaths> = IsExcludeAll<ExcludePaths> extends true
  ? false
  : IsWhitelistAll<IncludePaths> extends true
    ? [Extract<ExcludePaths, Key>] extends [never]
      ? true
      : false
    : [Extract<IncludePaths, Key>] extends [never]
      ? false
      : [Extract<ExcludePaths, Key>] extends [never]
        ? true
        : false;

type IsRelationAllowed<Key extends string, IncludePaths, ExcludePaths> = IsExcludeAll<ExcludePaths> extends true
  ? false
  : [Extract<ExcludePaths, Key | `${Key}.*`>] extends [never]
    ? IsWhitelistAll<IncludePaths> extends true
      ? true
      : [Extract<IncludePaths, Key | `${Key}.*`>] extends [never]
        ? HasDescendantPath<Key, IncludePaths>
        : true
    : false;

type ChildIncludePaths<Key extends string, IncludePaths> = IsWhitelistAll<IncludePaths> extends true
  ? never
  : [Extract<IncludePaths, Key | `${Key}.*`>] extends [never]
    ? AfterPrefix<Key, IncludePaths>
    : never;

type ChildExcludePaths<Key extends string, ExcludePaths> = IsExcludeAll<ExcludePaths> extends true
  ? "*"
  : AfterPrefix<Key, ExcludePaths>;

type ResolveDepth<Opts> = Opts extends { maxDepth: infer D }
  ? D extends SearchWhereDepth
    ? D
    : 2
  : 2;

type ResolveInclude<Opts> = Opts extends { include: readonly (infer P)[] } ? (P & string) : never;
type ResolveExclude<Opts> = Opts extends { exclude: readonly (infer P)[] } ? (P & string) : never;

type WhereShape<
  TEntity extends object,
  Depth extends SearchWhereDepth,
  IncludePaths,
  ExcludePaths,
> = {
  [K in ScalarKeys<TEntity> as IsScalarAllowed<K, IncludePaths, ExcludePaths> extends true ? K : never]?: TEntity[K];
} & (Depth extends 0
  ? {}
  : {
      [K in RelationKeys<TEntity> as IsRelationAllowed<K, IncludePaths, ExcludePaths> extends true
        ? K
        : never]?: WhereShape<
        RelationTarget<NonNullable<TEntity[K]>>,
        PrevDepth[Depth],
        ChildIncludePaths<K, IncludePaths>,
        ChildExcludePaths<K, ExcludePaths>
      >;
    });

export type SearchWherePath<TEntity extends object, Depth extends SearchWhereDepth = 2> =
  | "*"
  | ScalarKeys<TEntity>
  | RelationKeys<TEntity>
  | (Depth extends 0
      ? never
      : {
          [K in RelationKeys<TEntity>]: `${K}.*` | `${K}.${SearchWherePath<RelationTarget<NonNullable<TEntity[K]>>, PrevDepth[Depth]>}`;
        }[RelationKeys<TEntity>]);

type BaseSearchWhereOptions = {
  maxDepth?: SearchWhereDepth;
  include?: readonly string[];
  exclude?: readonly string[];
};

export type SearchWhereOptions<
  TEntity extends object,
  Depth extends SearchWhereDepth = 5,
> = {
  maxDepth?: Depth;
  include?: readonly SearchWherePath<TEntity, Depth>[];
  exclude?: readonly SearchWherePath<TEntity, Depth>[];
};

export type SearchWhere<TEntity extends object, Opts extends BaseSearchWhereOptions = {}> =
  Opts extends SearchWhereOptions<TEntity, ResolveDepth<Opts>>
    ? WhereShape<TEntity, ResolveDepth<Opts>, ResolveInclude<Opts>, ResolveExclude<Opts>>
    : never;
