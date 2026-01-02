import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { BlogPost } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq, or } from "metal-orm";

@Controller("/posts")
export class PostsController {

  @Get("/")
  async getPosts(
    query?: { authorId?: number; categoryId?: number; status?: string }
  ): Promise<BlogPost[]> {

    const session = getSession();
    const P = entityRef(BlogPost);
    let qb = selectFromEntity(BlogPost)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt");

    const conditions = [];
    if (query?.authorId) conditions.push(eq(P.authorId, query.authorId));
    if (query?.categoryId) conditions.push(eq(P.categoryId, query.categoryId));
    if (query?.status) conditions.push(eq(P.status, query.status));

    if (conditions.length > 0) {
      qb = qb.where(or(...conditions));
    }

    const posts = await qb.execute(session);
    return posts;
  }

  @Get("/:id")
  async getPost(id: number): Promise<BlogPost | null> {

    const session = getSession();
    const P = entityRef(BlogPost);
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
