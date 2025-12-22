// src/controllers/advanced.controller.ts
import { Controller, Get, Post, FromBody, FromPath, PaginationQuery, EntityResponse, CreateInput } from "../../../src/index.js";
import { User } from "../entities/user.entity.js";

// --- 1. Advanced Request DTOs ---

// INHERITANCE: UserListRequest automatically gets 'page' and 'limit' from PaginationQuery
// AND the generator will find them because we scan the Type properties.
export class UserListRequest extends PaginationQuery {
  // Implicitly @FromQuery because it's a GET request and extends a class
  search?: string; 
  
  @FromPath()
  tenantId!: string;
}

// COMPOSITION: Using the Type Helper for safety, but class for Decorators
// We implement the Type Helper to ensure our Class matches the Entity rule
export class CreateUserDto implements CreateInput<User, 'name' | 'email'> {
  @FromBody()
  name!: string;

  @FromBody()
  email!: string;
  
  // If I miss a field here that is required in CreateInput, TS throws an error at edit time.
}

// --- 2. The Controller ---

@Controller("advanced")
export class AdvancedController {

  @Get("/{tenantId}/users")
  // Generic Return Type: The generator must resolve EntityResponse<User[]> -> User schema
  public async listUsers(req: UserListRequest): Promise<EntityResponse<User[]>> {
    return [
      { id: "1", name: "Alice", email: "a@a.com", isActive: true, createdAt: "now" }
    ];
  }

  @Post("/")
  public async create(req: CreateUserDto): Promise<EntityResponse<User>> {
    return { 
        id: "123", 
        name: req.name, 
        email: req.email, 
        isActive: true, 
        createdAt: "now" 
    };
  }
}
