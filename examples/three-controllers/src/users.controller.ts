import { Controller, Get, Post, Delete } from "adorn-api";

interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
];

@Controller("/users")
export class UsersController {
  @Get("/")
  async getUsers(): Promise<User[]> {
    return users;
  }

  @Get("/:id")
  async getUser(id: number): Promise<User | null> {
    return users.find((u) => u.id === Number(id)) || null;
  }

  @Post("/")
  async createUser(body: { name: string; email: string }): Promise<User> {
    const newUser: User = {
      id: users.length + 1,
      name: body.name,
      email: body.email,
    };
    users.push(newUser);
    return newUser;
  }

  @Delete("/:id")
  async deleteUser(id: number): Promise<{ success: boolean }> {
    const index = users.findIndex((u) => u.id === Number(id));
    if (index !== -1) {
      users.splice(index, 1);
      return { success: true };
    }
    return { success: false };
  }
}
