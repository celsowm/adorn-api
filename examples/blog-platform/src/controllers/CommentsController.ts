import { Controller, Get, Post, Delete } from "adorn-api";
import { Comment as CommentEntity } from "../entities/index.js";
import { CommentRepo } from "../db.js";

@Controller("/comments")
export class CommentsController {
  @Get("/post/:postId")
  async getCommentsByPost(postId: string): Promise<CommentEntity[]> {
    return CommentRepo.findByPostId(postId);
  }

  @Get("/")
  async getComments(): Promise<CommentEntity[]> {
    return CommentRepo.findAll();
  }

  @Get("/:id")
  async getComment(id: string): Promise<CommentEntity | null> {
    const comment = await CommentRepo.findById(id);
    return comment || null;
  }

  @Post("/post/:postId")
  async createComment(
    postId: string,
    body: Pick<CommentEntity, "authorId" | "content">
  ): Promise<CommentEntity> {
    return CommentRepo.create({
      postId,
      ...body,
    });
  }

  @Delete("/:id")
  async deleteComment(id: string): Promise<{ success: boolean }> {
    await CommentRepo.delete(id);
    return { success: true };
  }
}
