import { Controller, Get, Post } from "adorn-api";

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
export class UserController {
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
}
