import { Controller, Get, Post } from "../../../../dist/index.js";

class UserDto {
  id!: number;
  name!: string;
  phone!: string | null;
  role!: 'admin' | 'user';
}

class CreateUserPayload {
  name!: string;
  phone!: string;
  age?: number;
  joinedAt?: Date;
}

interface GetUserQuery {
  verbose?: boolean;
}

const users: UserDto[] = [
  { id: 1, name: "Alan Turing", phone: "+44 123 456", role: "admin" },
];

@Controller("/users")
export class UserController {
  @Get("/")
  async getUsers(): Promise<UserDto[]> {
    return users;
  }

  @Get("/:id")
  async getUser(id: number, verbose?: boolean): Promise<UserDto | null> {
    const user = users.find(u => u.id === Number(id));
    if (!user) return null;
    if (verbose) {
      return { id: user.id, name: user.name, phone: user.phone, role: user.role };
    }
    return user;
  }

  @Post("/")
  async createUser(body: CreateUserPayload): Promise<UserDto> {
    const newUser: UserDto = {
      id: users.length + 1,
      name: body.name,
      phone: body.phone,
      role: "user",
    };
    users.push(newUser);
    return newUser;
  }
}
