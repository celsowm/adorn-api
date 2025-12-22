// src/controllers/user.controller.ts
import { Controller, Get, Post, FromQuery, FromPath, FromBody } from "../../../src/index.js";

// --- DTO Definitions (The substitute for Parameter Decorators) ---
export class GetUserRequest {
  @FromPath()
  userId!: string;
  
  @FromQuery()
  details?: boolean;
}

export class CreateUserRequest {
  @FromBody()
  name!: string;

  @FromBody()
  email!: string;
}

// --- The Controller ---
@Controller("users")
export class UserController {

  // Strong typing: 'req' is checked at edit time.
  @Get("/{userId}")
  public async getUser(req: GetUserRequest): Promise<string> {
    return `Getting user ${req.userId} with details: ${req.details}`;
  }

  @Post("/")
  public async createUser(req: CreateUserRequest): Promise<void> {
    console.log(`Creating user ${req.name}`);
  }
}
