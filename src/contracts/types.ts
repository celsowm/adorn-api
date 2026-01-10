export type ContractId = string | symbol;

export type ContractMode = 'list' | 'paged' | 'single';

import type { OpenApiComponents } from 'metal-orm';

export interface ContractSchemas {
  parameters?: unknown[];
  output?: unknown;
  input?: unknown;
  components?: OpenApiComponents;
}

export interface Contract<TQuery = unknown, TItem = unknown, TResult = unknown> {
  id: ContractId;
  mode: ContractMode;
  schemas?: ContractSchemas;
  resolveSchemas?: () => ContractSchemas;
  build?: (query: TQuery) => unknown;
  execute?: (ctx: unknown, query: TQuery) => Promise<TResult>;
}

export type ContractRef = Contract<any, any, any> | ContractId;

export type ContractQuery<C> = C extends Contract<infer TQuery, any, any> ? TQuery : never;
export type ContractItem<C> = C extends Contract<any, infer TItem, any> ? TItem : never;
export type ContractResult<C> = C extends Contract<any, any, infer TResult> ? TResult : never;

export interface Paginated<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
}

export type ContractList<C> = ContractItem<C>[];
export type ContractPaged<C> = Paginated<ContractItem<C>>;

export type ContractTypes<C> = {
  Query: ContractQuery<C>;
  Item: ContractItem<C>;
  Result: ContractResult<C>;
  List: ContractList<C>;
  Paged: ContractPaged<C>;
};
