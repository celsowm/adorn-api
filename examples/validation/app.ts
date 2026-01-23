import { Dto, Field, Get, Post, Body, Query, Params, Controller, t, createExpressApp } from "../..";

@Dto()
class CreateUserDto {
  @Field(t.string({ minLength: 1, maxLength: 50 }))
  name!: string;

  @Field(t.string({ format: "email" }))
  email!: string;

  @Field(t.optional(t.number({ minimum: 18, maximum: 120 })))
  age?: number;

  @Field(t.array(t.string(), { maxItems: 5 }))
  tags!: string[];
}

@Dto()
class UserQueryDto {
  @Field(t.optional(t.string()))
  search?: string;

  @Field(t.optional(t.number({ minimum: 0 })))
  page?: number;

  @Field(t.optional(t.number({ minimum: 1, maximum: 100 })))
  limit?: number;
}

@Controller("/users")
class UserController {
  private users: any[] = [];

  @Post("/")
  @Body(CreateUserDto)
  async createUser(ctx: any) {
    // The body is already validated and coerced
    console.log("Creating user with validated data:", ctx.body);
    this.users.push(ctx.body);
    return { message: "User created successfully", user: ctx.body };
  }

  @Get("/")
  @Query(UserQueryDto)
  async getUsers(ctx: any) {
    // The query params are already validated and coerced
    console.log("Getting users with validated query params:", ctx.query);
    return { users: this.users, query: ctx.query };
  }

  @Get("/:id")
  @Params(t.object({ id: t.number({ minimum: 1 }) }))
  async getUser(ctx: any) {
    // The params are already validated and coerced
    console.log("Getting user with validated id:", ctx.params.id);
    return { user: this.users[ctx.params.id - 1], id: ctx.params.id };
  }
}

async function main() {
  const app = await createExpressApp({
    controllers: [UserController],
    validation: {
      enabled: true,
      mode: "strict"
    }
  });

  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    console.log("\nTest validation examples:");
    console.log("1. Valid request:");
    console.log('curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d \'{"name":"John Doe","email":"john@example.com","age":30,"tags":["admin","user"]}\'');
    console.log("\n2. Invalid request (missing required fields):");
    console.log('curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d \'{"email":"john@example.com"}\'');
    console.log("\n3. Invalid request (invalid email):");
    console.log('curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d \'{"name":"John Doe","email":"invalid-email","age":30}\'');
    console.log("\n4. Invalid request (age too young):");
    console.log('curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d \'{"name":"John Doe","email":"john@example.com","age":17}\'');
    console.log("\n5. Invalid request (too many tags):");
    console.log('curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d \'{"name":"John Doe","email":"john@example.com","age":30,"tags":["a","b","c","d","e","f"]}\'');
  });
}

main().catch(console.error);
