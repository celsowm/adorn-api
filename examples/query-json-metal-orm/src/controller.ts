import { Controller, Get, QueryJson } from "adorn-api";
import { Post, User } from "./entities/index.js";
import { getSession } from "./db.js";
import { selectFromEntity, entityRefs, eq, and } from "metal-orm";

interface PostFilter {
    title?: string;
    status?: string;
    author?: {
        name?: string;
    };
}

@Controller("/posts")
export class PostsController {
    @Get("/")
    @QueryJson("filter")
    async getPosts(filter?: PostFilter): Promise<Post[]> {
        const session = getSession();
        const [P, U] = entityRefs(Post, User);
        let qb = selectFromEntity(Post).include({ author: true });

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

        return qb.execute(session) as unknown as Promise<Post[]>;
    }
}
