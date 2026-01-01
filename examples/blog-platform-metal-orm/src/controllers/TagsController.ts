import { Controller, Get, Post, Delete } from "adorn-api";
import { Tag } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity } from "metal-orm";

@Controller("/tags")
export class TagsController {
  @Get("/")
  async getTags(): Promise<Tag[]> {
    const session = getSession();
    const [tags] = await selectFromEntity(Tag)
      .select("id", "name", "color")
      .executePlain(session);
    return tags as unknown as Tag[];
  }

  @Get("/:id")
  async getTag(id: number): Promise<Tag | null> {
    const session = getSession();
    const [tag] = await selectFromEntity(Tag)
      .select("id", "name", "color")
      .executePlain(session);
    return (tag as unknown as Tag) ?? null;
  }

  @Post("/")
  async createTag(body: Pick<Tag, "name" | "color">): Promise<Tag> {
    const session = getSession();
    const tag = new Tag();
    tag.name = body.name;
    tag.color = body.color;
    await session.persist(tag);
    await session.flush();
    return tag;
  }

  @Delete("/:id")
  async deleteTag(id: number): Promise<{ success: boolean }> {
    const session = getSession();
    const tag = await session.find(Tag, id);
    if (tag) {
      await session.remove(tag);
      await session.flush();
    }
    return { success: true };
  }
}
