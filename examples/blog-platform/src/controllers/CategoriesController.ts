import { Controller, Get, Post, Delete } from "adorn-api";
import { Category as CategoryEntity } from "../entities/index.js";
import { CategoryRepo } from "../db.js";

@Controller("/categories")
export class CategoriesController {
  @Get("/")
  async getCategories(): Promise<CategoryEntity[]> {
    return CategoryRepo.findAll();
  }

  @Get("/:id")
  async getCategory(id: string): Promise<CategoryEntity | null> {
    const category = await CategoryRepo.findById(id);
    return category || null;
  }

  @Post("/")
  async createCategory(
    body: Pick<CategoryEntity, "name" | "slug" | "description">
  ): Promise<CategoryEntity> {
    return CategoryRepo.create(body);
  }

  @Delete("/:id")
  async deleteCategory(id: string): Promise<{ success: boolean }> {
    await CategoryRepo.delete(id);
    return { success: true };
  }
}
