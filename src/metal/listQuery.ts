import type { SearchWhere, SearchWhereDepth } from "./searchWhere.js";
import type { QueryOptions } from "./queryOptions.js";

export type ListQuery<TEntity extends object, Depth extends SearchWhereDepth = 2> = QueryOptions<TEntity, Depth> & {
  page?: number;
  pageSize?: number;
}
