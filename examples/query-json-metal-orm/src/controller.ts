import { Controller, Get } from "adorn-api";
import type { ListQuery, QueryOptions } from "adorn-api/metal";
import { applyListQuery } from "adorn-api/metal";
import type { PaginatedResult } from "metal-orm";
import { Post, User } from "./entities/index.js";
import { getSession } from "./db.js";
import { selectFromEntity, entityRefs, eq, and } from "metal-orm";

type PostQueryOptions = QueryOptions<Post>;

@Controller("/posts")
export class PostsController {
  @Get("/")
  async getPosts(query: ListQuery<Post>): Promise<PaginatedResult<Post>> {
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
        const col = (P.$ as Record<string, any>)[fieldName];
        if (col) {
          qb = qb.orderBy(col, direction);
        }
      }
    }

    return applyListQuery(qb, session, query);
  }
}
