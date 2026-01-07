/**
 * Represents a query for listing entities with optional filtering, sorting, and pagination.
 * 
 * @typeParam TEntity - The entity type being queried
 * @typeParam Depth - Maximum nesting depth for relations (default: 2)
 * 
 * @example
 * ```ts
 * type UserListQuery = ListQuery<User, 2>;
 * const query: UserListQuery = {
 *   where: { name: { contains: "John" } },
 *   sort: "-createdAt",
 *   page: 1,
 *   pageSize: 20
 * };
 * ```
 */
import type { SearchWhereDepth } from "./searchWhere.js";
import type { QueryOptions } from "./queryOptions.js";

export type ListQuery<TEntity extends object, Depth extends SearchWhereDepth = 2> = QueryOptions<TEntity, Depth> & {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
}
