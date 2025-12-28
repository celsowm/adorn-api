declare module 'metal-orm' {
  export type EntityConstructor<T = object> = new (...args: any[]) => T;

  export interface ColumnDef<T extends string = string, TRuntime = unknown> {
    name: string;
    type: T;
    args?: unknown[];
    notNull?: boolean;
    default?: TRuntime | { raw: string };
    autoIncrement?: boolean;
    generated?: 'always' | 'byDefault';
    tsType?: TRuntime;
  }

  export interface TableDef<TColumns extends Record<string, ColumnDef> = Record<string, ColumnDef>> {
    name: string;
    columns: TColumns;
  }

  export function getTableDefFromEntity<TTable extends TableDef = TableDef>(
    ctor: EntityConstructor,
  ): TTable | undefined;

  export type SaveGraphInputPayload<TEntity> = unknown;
}
