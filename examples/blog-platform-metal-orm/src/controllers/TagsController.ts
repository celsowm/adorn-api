import { Controller, Get, Post, Delete } from "adorn-api";
import { Tag } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/tags")
export class TagsController {
  @Get("/")
  async getTags(): Promise<Tag[]> {
    const session = getSession();
    const tags = await selectFromEntity(Tag)
      .select("id", "name", "color")
      .execute(session);
    return tags;
  }

  @Get("/:id")
  async getTag(id: number): Promise<Tag | null> {
    const session = getSession();
    const T = entityRef(Tag);
    const tags = await selectFromEntity(Tag)
      .select("id", "name", "color")
      .where(eq(T.id, id))
      .execute(session);
    return tags[0] ?? null;
  }

  @Post("/")
  async createTag(body: Pick<Tag, "name" | "color">): Promise<Tag> {
    const session = getSession();
    const tag = await session.saveGraphAndFlush(
      Tag,
      { ...body }
    );
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
