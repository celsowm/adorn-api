import { Controller, Get, Post, Delete } from "adorn-api";
import { Category } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity } from "metal-orm";

@Controller("/categories")
export class CategoriesController {
  @Get("/")
  async getCategories(): Promise<Category[]> {
    const session = getSession();
    const [categories] = await selectFromEntity(Category)
      .select("id", "name", "slug", "description")
      .executePlain(session);
    return categories as unknown as Category[];
  }

  @Get("/:id")
  async getCategory(id: number): Promise<Category | null> {
    const session = getSession();
    const [category] = await selectFromEntity(Category)
      .select("id", "name", "slug", "description")
      .executePlain(session);
    return (category as unknown as Category) ?? null;
  }

  @Post("/")
  async createCategory(body: Pick<Category, "name" | "slug" | "description">): Promise<Category> {
    const session = getSession();
    const category = new Category();
    category.name = body.name;
    category.slug = body.slug;
    category.description = body.description;
    await session.persist(category);
    await session.flush();
    return category;
  }

  @Delete("/:id")
  async deleteCategory(id: number): Promise<{ success: boolean }> {
    const session = getSession();
    const category = await session.find(Category, id);
    if (category) {
      await session.remove(category);
      await session.flush();
    }
    return { success: true };
  }
}
