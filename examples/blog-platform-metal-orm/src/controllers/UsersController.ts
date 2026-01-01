import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { User } from "../entities/index.js";
import { getSession } from "../db.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/users")
export class UsersController {
  @Get("/")
  async getUsers(): Promise<User[]> {
    const session = getSession();
    const [users] = await selectFromEntity(User)
      .select("id", "email", "name", "bio", "createdAt")
      .executePlain(session);
    return users as unknown as User[];
  }

  @Get("/:id")
  async getUser(id: number): Promise<User | null> {
    const session = getSession();
    const U = entityRef(User);
    const [user] = await selectFromEntity(User)
      .select("id", "email", "name", "bio", "createdAt")
      .where(eq(U.id, id))
      .executePlain(session);
    return (user as unknown as User) ?? null;
  }

  @Post("/")
  async createUser(body: Pick<User, "email" | "name" | "bio">): Promise<User> {
    const session = getSession();
    const user = new User();
    user.email = body.email;
    user.name = body.name;
    user.bio = body.bio;
    user.createdAt = new Date().toISOString();
    await session.persist(user);
    await session.flush();
    return user;
  }

  @Put("/:id")
  async updateUser(
    id: number,
    body: Pick<User, "name" | "bio">
  ): Promise<User | null> {
    const session = getSession();
    const user = await session.find(User, id);
    if (!user) return null;
    if (body.name !== undefined) user.name = body.name;
    if (body.bio !== undefined) user.bio = body.bio;
    await session.flush();
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
