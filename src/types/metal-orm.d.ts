declare module 'metal-orm' {
  export type EntityConstructor<T = object> = new (...args: any[]) => T;

  export interface ColumnDef<T extends string = string, TRuntime = unknown> {
    name: string;
    type: T;
    args?: unknown[];
    dialectTypes?: Partial<Record<string, string>>;
    notNull?: boolean;
    primary?: boolean;
    default?: TRuntime | { raw: string };
    autoIncrement?: boolean;
    generated?: 'always' | 'byDefault';
    tsType?: TRuntime;
  }

  export interface TableDef<TColumns extends Record<string, ColumnDef> = Record<string, ColumnDef>> {
    name: string;
    columns: TColumns;
    relations?: Record<string, unknown>;
  }

  export interface DbExecutor {
    readonly capabilities: { transactions: boolean };
    executeSql(sql: string, params?: unknown[]): Promise<unknown[]>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    dispose(): Promise<void>;
  }

  export interface DbExecutorFactory {
    createExecutor(): DbExecutor;
    createTransactionalExecutor(): DbExecutor;
    dispose(): Promise<void>;
  }

  export class Orm {
    constructor(opts: { dialect: unknown; executorFactory: DbExecutorFactory });
    dispose(): Promise<void>;
    createSession?(): OrmSession;
    transaction?<T>(fn: (session: OrmSession) => Promise<T>): Promise<T>;
  }

  export class OrmSession {
    constructor(opts: { orm: Orm; executor: DbExecutor });
    persist(entity: object): Promise<void>;
    commit(): Promise<void>;
    dispose(): Promise<void>;
  }

  export class SqliteDialect {}

  export interface HasManyCollection<TChild> {
    length: number;
    [Symbol.iterator](): Iterator<TChild>;
    load(): Promise<TChild[]>;
    getItems(): TChild[];
    add(data: Partial<TChild>): TChild;
    attach(entity: TChild): void;
    remove(entity: TChild): void;
    clear(): void;
  }

  export type BelongsToReference<TParent extends object = object> = {
    load(): Promise<TParent | null>;
    get(): TParent | null;
    set(data: Partial<TParent> | TParent | null): TParent | null;
  } & Partial<TParent>;

  export function Entity(options?: { tableName?: string; hooks?: unknown }): any;
  export function Column(
    definition:
      | ColumnDef
      | {
          type: string;
          args?: unknown[];
          dialectTypes?: Partial<Record<string, string>>;
          notNull?: boolean;
          primary?: boolean;
          tsType?: unknown;
        }
  ): any;
  export function PrimaryKey(
    definition:
      | ColumnDef
      | {
          type: string;
          args?: unknown[];
          dialectTypes?: Partial<Record<string, string>>;
          notNull?: boolean;
          primary?: boolean;
          tsType?: unknown;
        }
  ): any;
  export function HasMany(options: {
    target: () => unknown;
    foreignKey?: string;
    localKey?: string;
    cascade?: unknown;
  }): any;
  export function BelongsTo(options: {
    target: () => unknown;
    foreignKey: string;
    localKey?: string;
    cascade?: unknown;
  }): any;

  export const col: {
    int(): ColumnDef<'int'>;
    varchar(length: number): ColumnDef<'varchar'>;
    autoIncrement<T extends string>(def: ColumnDef<T>): ColumnDef<T>;
    notNull<T extends string>(def: ColumnDef<T>): ColumnDef<T>;
    primaryKey?<T extends string>(def: ColumnDef<T>): ColumnDef<T>;
  };

  export function bootstrapEntities(): TableDef[];

  export type OrderDirection = 'ASC' | 'DESC';
  export type OrderingTerm = unknown;

  export interface SelectQueryBuilder<T = unknown> {
    select(...cols: string[]): SelectQueryBuilder<T>;
    includeLazy(relationName: string, options?: unknown): SelectQueryBuilder<T>;
    where(condition: unknown): SelectQueryBuilder<T>;
    orderBy(
      term: ColumnDef | OrderingTerm,
      directionOrOptions?:
        | OrderDirection
        | { direction?: OrderDirection; nulls?: 'FIRST' | 'LAST'; collation?: string }
    ): SelectQueryBuilder<T>;
    execute(session: OrmSession): Promise<T[]>;
    executePlain(session: OrmSession): Promise<Record<string, unknown>[]>;
  }

  export function selectFromEntity<TEntity extends object>(
    ctor: EntityConstructor<TEntity>
  ): SelectQueryBuilder<TEntity>;

  export function entityRef<TEntity extends object>(
    ctor: EntityConstructor<TEntity>
  ): Record<string, ColumnDef>;

  export function eq(column: unknown, value: unknown): unknown;

  export function createSqliteExecutor(client: {
    all(sql: string, params?: unknown[]): Promise<Array<Record<string, unknown>>>;
    run?(sql: string, params?: unknown[]): Promise<unknown>;
    beginTransaction?(): Promise<void>;
    commitTransaction?(): Promise<void>;
    rollbackTransaction?(): Promise<void>;
  }): DbExecutor;

  export function getTableDefFromEntity<TTable extends TableDef = TableDef>(
    ctor: EntityConstructor,
  ): TTable | undefined;

  export type SaveGraphInputPayload<TEntity> = unknown;
}
