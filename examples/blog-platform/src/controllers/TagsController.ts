import { Controller, Get, Post, Delete } from "adorn-api";
import { Tag as TagEntity } from "../entities/index.js";
import { TagRepo } from "../db.js";

@Controller("/tags")
export class TagsController {
  @Get("/")
  async getTags(): Promise<TagEntity[]> {
    return TagRepo.findAll();
  }

  @Get("/:id")
  async getTag(id: string): Promise<TagEntity | null> {
    const tag = await TagRepo.findById(id);
    return tag || null;
  }

  @Post("/")
  async createTag(
    body: Pick<TagEntity, "name" | "color">
  ): Promise<TagEntity> {
    return TagRepo.create(body);
  }

  @Delete("/:id")
  async deleteTag(id: string): Promise<{ success: boolean }> {
    await TagRepo.delete(id);
    return { success: true };
  }
}
