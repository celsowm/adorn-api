import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { User as UserEntity } from "../entities/index.js";
import { UserRepo } from "../db.js";

@Controller("/users")
export class UsersController {
  @Get("/")
  async getUsers(): Promise<UserEntity[]> {
    return UserRepo.findAll();
  }

  @Get("/:id")
  async getUser(id: string): Promise<UserEntity | null> {
    const user = await UserRepo.findById(id);
    return user || null;
  }

  @Post("/")
  async createUser(
    body: Pick<UserEntity, "email" | "name" | "bio">
  ): Promise<UserEntity> {
    return UserRepo.create(body);
  }

  @Put("/:id")
  async updateUser(
    id: string,
    body: Partial<Pick<UserEntity, "name" | "bio">>
  ): Promise<UserEntity | null> {
    return UserRepo.update(id, body);
  }

  @Delete("/:id")
  async deleteUser(id: string): Promise<{ success: boolean }> {
    await UserRepo.delete(id);
    return { success: true };
  }
}
