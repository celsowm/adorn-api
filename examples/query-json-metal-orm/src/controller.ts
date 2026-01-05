import { Controller, Get, QueryJson, Paginated } from "adorn-api";
import type { PaginationParams, PaginatedResponse } from "adorn-api";
import type { QueryOptions } from "adorn-api/metal";
import { Post, User } from "./entities/index.js";
import { getSession } from "./db.js";
import { selectFromEntity, entityRefs, eq, and } from "metal-orm";

type PostQueryOptions = QueryOptions<Post>;

@Controller("/posts")
export class PostsController {
    @Get("/")
    @QueryJson("query")
    @Paginated({ defaultPageSize: 10 })
    async getPosts(
        query?: PostQueryOptions,
        pagination: PaginationParams = { page: 1, pageSize: 10 }
    ): Promise<PaginatedResponse<Post>> {
        const session = getSession();
        const [P, U] = entityRefs(Post, User);
        let qb = selectFromEntity(Post).include({ author: true });

        const filter = query?.where;
        const conditions = [];

        if (filter?.status) {
            conditions.push(eq(P.status, filter.status));
        }
        if (filter?.title) {
            conditions.push(eq(P.title, filter.title));
        }

        if (filter?.author?.name) {
            qb = qb.whereHas("author", (authorQb) =>
                authorQb.where(eq(U.$.name, filter.author!.name!))
            );
        }

        if (conditions.length > 0) {
            qb = qb.where(and(...conditions));
        }

        if (query?.sort) {
            const sorts = Array.isArray(query.sort) ? query.sort : [query.sort];
            for (const s of sorts) {
                const direction = (s.startsWith("-") ? "DESC" : "ASC") as "ASC" | "DESC";
                const fieldName = s.startsWith("-") ? s.slice(1) : s;
                // Safely access column references from P.$
                const col = (P.$ as Record<string, any>)[fieldName];
                if (col) {
                    qb = qb.orderBy(col, direction);
                }
            }
        }

        return qb.executePaged(session, pagination) as unknown as Promise<PaginatedResponse<Post>>;
    }
}
