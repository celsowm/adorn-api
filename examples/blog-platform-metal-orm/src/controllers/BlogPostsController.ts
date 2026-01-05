import { Controller, Get, Post, Put, Delete } from "../../../dist/index.js";
import type { SearchWhere, ListQuery } from "../../../dist/metal/index.js";
import { applyListQuery } from "../../../dist/metal/index.js";
import type { PaginatedResult } from "metal-orm";
import { BlogPost, Category, Tag, User } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRefs, eq, and, like } from "metal-orm";

type PostSearchWhere = SearchWhere<BlogPost, {
  include: ["status", "author.id", "author.email", "category.id", "category.slug", "tags.name", "comments.author.name"];
}> & {
  q?: string;
  hasComments?: boolean;
};

@Controller("/blog-posts")
export class BlogPostsController {

  @Get("/")
  async getPosts(query: ListQuery<BlogPost> & PostSearchWhere): Promise<PaginatedResult<BlogPost>> {
    const session = getSession();
    const [P, U, C, T] = entityRefs(BlogPost, User, Category, Tag);
    let qb = selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt");

    qb = qb.include({
      author: true,
      category: true,
      tags: true,
      comments: { include: { author: true } }
    });

    const conditions = [];

    if (query?.where?.author?.id !== undefined) {
      conditions.push(eq(P.authorId, Number(query.where.author.id)));
    }
    if (query?.where?.category?.id !== undefined) {
      conditions.push(eq(P.categoryId, Number(query.where.category.id)));
    }
    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    return applyListQuery(qb, session, query);
  }

  @Get("/:id")
  async getPost(id: number): Promise<BlogPost | null> {

    const session = getSession();
    const [P] = entityRefs(BlogPost);
    const posts = await selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt")
      .where(eq(P.id, id))
      .execute(session);
    return posts[0] ?? null;

  }

  @Post("/")
  async createPost(
    body: Pick<BlogPost, "title" | "content" | "authorId" | "categoryId">
  ): Promise<BlogPost> {

    const session = getSession();
    const post = await session.saveGraphAndFlush(
      BlogPost,
      {
        ...body,
        status: "draft",
        createdAt: new Date()
      }
    );
    return post;

  }

  @Put("/:id")
  async updatePost(
    id: number,
    body: Pick<BlogPost, "title" | "content" | "status" | "categoryId" | "publishedAt">
  ): Promise<BlogPost | null> {

    const session = getSession();
    const post = await session.updateGraph(
      BlogPost,
      { id, ...body }
    );
    return post;

  }

  @Delete("/:id")
  async deletePost(id: number): Promise<{ success: boolean }> {

    const session = getSession();
    const post = await session.find(BlogPost, id);
    if (post) {
      await session.remove(post);
      await session.flush();
    }
    return { success: true };

  }
}
