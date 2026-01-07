/**
 * Query options for filtering and sorting entities.
 * 
 * @typeParam TEntity - The entity type being queried
 * @typeParam Depth - Maximum nesting depth for relations (default: 5)
 */
import type { SearchWhere, SearchWhereDepth } from "./searchWhere.js";

export type QueryOptions<
    TEntity extends object,
    Depth extends SearchWhereDepth = 5,
> = {
    /** Where clause for filtering results */
    where?: SearchWhere<TEntity, { maxDepth: Depth }>;
    /** Sort fields (comma-separated string or array, use "-" prefix for DESC) */
    sort?: string | string[];
};
