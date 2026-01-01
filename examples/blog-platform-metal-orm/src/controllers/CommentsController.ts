import { Controller, Get, Post, Delete } from "adorn-api";
import { Comment } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/comments")
export class CommentsController {
  @Get("/post/:postId")
  async getCommentsByPost(postId: number): Promise<Comment[]> {
    const session = getSession();
    const C = entityRef(Comment);
    const comments = await selectFromEntity(Comment)
      .select("id", "postId", "authorId", "content", "createdAt")
      .where(eq(C.postId, postId))
      .execute(session);
    return comments;
  }

  @Get("/")
  async getComments(): Promise<Comment[]> {
    const session = getSession();
    const comments = await selectFromEntity(Comment)
      .select("id", "postId", "authorId", "content", "createdAt")
      .execute(session);
    return comments;
  }

  @Get("/:id")
  async getComment(id: number): Promise<Comment | null> {
    const session = getSession();
    const C = entityRef(Comment);
    const comments = await selectFromEntity(Comment)
      .select("id", "postId", "authorId", "content", "createdAt")
      .where(eq(C.id, id))
      .execute(session);
    return comments[0] ?? null;
  }

  @Post("/post/:postId")
  async createComment(
    postId: number,
    body: Pick<Comment, "authorId" | "content">
  ): Promise<Comment> {
    const session = getSession();
    const comment = new Comment();
    comment.postId = postId;
    comment.authorId = body.authorId;
    comment.content = body.content;
    comment.createdAt = new Date().toISOString();
    await session.persist(comment);
    await session.flush();
    return comment;
  }

  @Delete("/:id")
  async deleteComment(id: number): Promise<{ success: boolean }> {
    const session = getSession();
    const comment = await session.find(Comment, id);
    if (comment) {
      await session.remove(comment);
      await session.flush();
    }
    return { success: true };
  }
}
