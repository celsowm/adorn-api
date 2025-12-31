import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { Post as PostEntity } from "../entities/index.js";
import { PostRepo } from "../db.js";

@Controller("/posts")
export class PostsController {
  @Get("/")
  async getPosts(
    query?: { authorId?: string; categoryId?: string; status?: string }
  ): Promise<PostEntity[]> {
    return PostRepo.findAll(query);
  }

  @Get("/:id")
  async getPost(id: string): Promise<PostEntity | null> {
    const post = await PostRepo.findById(id);
    return post || null;
  }

  @Post("/")
  async createPost(
    body: Pick<PostEntity, "title" | "content" | "authorId" | "categoryId">
  ): Promise<PostEntity> {
    return PostRepo.create({
      ...body,
      status: "draft",
    });
  }

  @Put("/:id")
  async updatePost(
    id: string,
    body: Partial<Pick<PostEntity, "title" | "content" | "status" | "categoryId">>
  ): Promise<PostEntity | null> {
    return PostRepo.update(id, body);
  }

  @Delete("/:id")
  async deletePost(id: string): Promise<{ success: boolean }> {
    await PostRepo.delete(id);
    return { success: true };
  }
}
