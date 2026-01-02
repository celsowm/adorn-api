import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { User } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/users")
export class UsersController {
  @Get("/")
  async getUsers(): Promise<User[]> {
    const session = getSession();
    const users = await selectFromEntity(User)
      .select("id", "email", "name", "bio", "createdAt")
      .execute(session);
    return users;
  }

  @Get("/:id")
  async getUser(id: number): Promise<User | null> {
    const session = getSession();
    const U = entityRef(User);
    const users = await selectFromEntity(User)
      .select("id", "email", "name", "bio", "createdAt")
      .where(eq(U.id, id))
      .execute(session);
    return users[0] ?? null;
  }

  @Post("/")
  async createUser(body: Pick<User, "email" | "name" | "bio">): Promise<User> {
    const session = getSession();
    const user = await session.saveGraphAndFlush(
      User,
      {
        ...body,
        createdAt: new Date()
      }
    );
    return user;
  }

  @Put("/:id")
  async updateUser(
    id: number,
    body: Pick<User, "name" | "bio">
  ): Promise<User | null> {
    const session = getSession();
    const user = await session.updateGraph(
      User,
      { id, ...body }
    );
    return user;
  }

  @Delete("/:id")
  async deleteUser(id: number): Promise<{ success: boolean }> {
    const session = getSession();
    const user = await session.find(User, id);
    if (user) {
      await session.remove(user);
      await session.flush();
    }
    return { success: true };
  }
}
