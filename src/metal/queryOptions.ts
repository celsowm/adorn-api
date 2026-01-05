import type { SearchWhere, SearchWhereOptions, SearchWhereDepth } from "./searchWhere.js";

export type QueryOptions<
    TEntity extends object,
    Depth extends SearchWhereDepth = 5,
> = {
    where?: SearchWhere<TEntity, { maxDepth: Depth }>;
    sort?: string | string[];
};
