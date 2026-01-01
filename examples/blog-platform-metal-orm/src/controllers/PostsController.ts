import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { Post as PostEntity } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq, or } from "metal-orm";

@Controller("/posts")
export class PostsController {

  @Get("/")
  async getPosts(
    query?: { authorId?: number; categoryId?: number; status?: string }
  ): Promise<PostEntity[]> {

    const session = getSession();
    const P = entityRef(PostEntity);
    let qb = selectFromEntity(PostEntity)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt");

    const conditions = [];
    if (query?.authorId) conditions.push(eq(P.authorId, query.authorId));
    if (query?.categoryId) conditions.push(eq(P.categoryId, query.categoryId));
    if (query?.status) conditions.push(eq(P.status, query.status));

    if (conditions.length > 0) {
      qb = qb.where(or(...conditions));
    }

    const [posts] = await qb.executePlain(session);
    return posts as unknown as PostEntity[];
  }

  @Get("/:id")
  async getPost(id: number): Promise<PostEntity | null> {

    const session = getSession();
    const P = entityRef(PostEntity);
    const [post] = await selectFromEntity(PostEntity)
      .select("id", "authorId", "categoryId", "title", "content", "status", "publishedAt", "createdAt")
      .where(eq(P.id, id))
      .executePlain(session);
    return (post as unknown as PostEntity) ?? null;

  }

  @Post("/")
  async createPost(
    body: Pick<PostEntity, "title" | "content" | "authorId" | "categoryId">
  ): Promise<PostEntity> {

    const session = getSession();
    const post = new PostEntity();
    post.title = body.title;
    post.content = body.content;
    post.authorId = body.authorId;
    post.categoryId = body.categoryId;
    post.status = "draft";
    post.createdAt = new Date().toISOString();
    await session.persist(post);
    await session.flush();
    return post;

  }

  @Put("/:id")
  async updatePost(
    id: number,
    body: Pick<PostEntity, "title" | "content" | "status" | "categoryId" | "publishedAt">
  ): Promise<PostEntity | null> {

    const session = getSession();
    const post = await session.find(PostEntity, id);
    if (!post) return null;
    if (body.title !== undefined) post.title = body.title;
    if (body.content !== undefined) post.content = body.content;
    if (body.status !== undefined) post.status = body.status;
    if (body.categoryId !== undefined) post.categoryId = body.categoryId;
    if (body.publishedAt !== undefined) post.publishedAt = body.publishedAt;
    await session.flush();
    return post;

  }

  @Delete("/:id")
  async deletePost(id: number): Promise<{ success: boolean }> {

    const session = getSession();
    const post = await session.find(PostEntity, id);
    if (post) {
      await session.remove(post);
      await session.flush();
    }
    return { success: true };
    
  }
}
