# Adorn API

A TypeScript API framework using **Standard TC39 Decorators** (not experimental decorators) to build type-safe, self-documenting APIs with automatic OpenAPI/Swagger generation.

## Features

- ✅ **Standard Decorators**: Uses TC39 Stage 3 decorators (no experimental flags needed)
- ✅ **Type-Safe DTOs**: Full TypeScript type checking at edit time
- ✅ **Automatic Swagger Generation**: Generates OpenAPI 3.0 documentation from your code
- ✅ **Runtime Route Generation**: Automatically creates Express routes
- ✅ **Inheritance Support**: Extend base DTO classes with full type information
- ✅ **Generic Response Types**: `EntityResponse<T>`, `CreateInput<T>`, etc.
- ✅ **Authentication**: Built-in `@Authorized` decorator
- ✅ **Union Types & Enums**: Automatically converted to Swagger enums
- ✅ **Nested Objects**: Recursive type resolution for complex DTOs

## Installation

```bash
npm install adorn-api
```

## Quick Start

### 1. Create a Controller

```typescript
// src/controllers/user.controller.ts
import { Controller, Get, Post, FromQuery, FromPath, FromBody } from "adorn-api";

class GetUserRequest {
  @FromPath()
  userId!: string;
  
  @FromQuery()
  details?: boolean;
}

@Controller("users")
export class UserController {
  @Get("/{userId}")
  public async getUser(req: GetUserRequest): Promise<string> {
    return `Getting user ${req.userId} with details: ${req.details}`;
  }
}
```

### 2. Generate Swagger and Routes

```bash
npx adorn-api gen
```

This generates:
- `swagger.json` - OpenAPI 3.0 specification
- `src/routes.ts` - Express route handlers

### 3. Start Your Server

```typescript
// src/server.ts
import express from "express";
import { RegisterRoutes } from "./routes.js";

const app = express();
app.use(express.json());

RegisterRoutes(app);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

Visit http://localhost:3000/docs to see your Swagger UI.

## Advanced Usage

### Inheritance & Generics

```typescript
import { PaginationQuery, EntityResponse, CreateInput } from "../lib/common.js";

// Inherit pagination properties
class UserListRequest extends PaginationQuery {
  search?: string; 
  
  @FromPath()
  tenantId!: string;
}

// Use generic type helpers
class CreateUserDto implements CreateInput<User, 'name' | 'email'> {
  @FromBody()
  name!: string;

  @FromBody()
  email!: string;
}

@Controller("advanced")
export class AdvancedController {
  @Get("/{tenantId}/users")
  public async listUsers(req: UserListRequest): Promise<EntityResponse<User[]>> {
    return [/* ... */];
  }
}
```

### Authentication

```typescript
import { Authorized } from "../lib/decorators.js";

@Controller("profile")
export class ProfileController {
  @Authorized("admin")
  @Post("/update")
  public async update(req: UpdateProfileDto) {
    // Only accessible with valid Bearer token
    return { success: true };
  }
}
```

## Project Structure

```
adorn-api/
├── src/
│   ├── lib/
│   │   ├── decorators.ts      # Standard decorators (@Get, @Post, @Controller, etc.)
│   │   └── common.ts          # Common types (PaginationQuery, EntityResponse, etc.)
│   ├── cli/
│   │   ├── generate-swagger.ts # Swagger/OpenAPI generator
│   │   └── generate-routes.ts  # Express route generator
│   └── index.ts               # Main library entry point
├── tests/
│   └── example-app/           # Example application using adorn-api
│       ├── controllers/       # Example controllers
│       ├── entities/          # Example entities
│       ├── middleware/        # Example middleware
│       ├── routes.ts         # Generated routes (auto-generated)
│       └── server.ts         # Example Express server
├── swagger.json              # Generated OpenAPI spec
└── package.json
```

## Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run gen:spec` - Generate Swagger documentation only
- `npm run gen:routes` - Generate Express routes only
- `npm run gen` - Generate both Swagger and routes
- `npm run example` - Run the example application

### Testing the Library

```bash
# Generate from example app
npm run gen

# Run the example server
npm run example
```

## How It Works

### 1. Decorators (src/lib/decorators.ts)

Uses **Standard TC39 Decorators** with `context.addInitializer()` to attach metadata:

```typescript
export function Get(path: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      // Store route metadata
      const routes = (this as any)[META_KEY] || [];
      routes.push({ method: 'get', path, methodName: String(context.name) });
      (this as any)[META_KEY] = routes;
    });
    return originalMethod;
  };
}
```

### 2. Swagger Generator (src/cli/generate-swagger.ts)

Uses **ts-morph** to statically analyze TypeScript code:

- Parses `@Controller` and `@Get`/`@Post` decorators
- Resolves DTO types including inheritance and generics
- Converts TypeScript types to JSON Schema
- Handles union types (enums), nested objects, and Promise unwrapping
- Generates OpenAPI 3.0 specification

### 3. Route Generator (src/cli/generate-routes.ts)

Generates actual Express route handlers:

```typescript
// Generated code in src/routes.ts
app.get('/users/:userId', async (req: Request, res: Response) => {
    const controller = new UserController();
    const input: any = {};
    Object.assign(input, req.query);
    Object.assign(input, req.params);
    Object.assign(input, req.body);
    
    const response = await controller.getUser(input);
    res.status(200).json(response);
});
```

## Why Standard Decorators?

1. **Future-Proof**: Uses the official TC39 decorator proposal (Stage 3)
2. **No Experimental Flags**: Works with `"experimentalDecorators": false`
3. **Better Type Safety**: Leverages TypeScript's type system instead of runtime reflection
4. **Cleaner API**: Single-parameter DTO pattern is more explicit than parameter decorators

## Comparison with tsoa

| Feature | tsoa (Legacy) | adorn-api |
|---------|---------------|-----------|
| Decorators | Experimental (`emitDecoratorMetadata`) | Standard TC39 |
| Parameter Decorators | `@Body() body: string` | DTO classes with `@FromBody()` |
| Type Safety | Runtime reflection | Edit-time type checking |
| Inheritance | Limited | Full support |
| Generics | Complex | Native TypeScript |
| Future Compatibility | Deprecated in future TS | Officially supported |

## Next Steps

To make this production-ready:

1. **Validation**: Integrate Zod or class-validator in the route generator
2. **Error Handling**: Add centralized error handling middleware
3. **Database Integration**: Add ORM support (Prisma, TypeORM, etc.)
4. **Testing**: Add unit and integration test utilities
5. **CORS**: Add CORS configuration
6. **Rate Limiting**: Add rate limiting middleware
7. **Logging**: Add structured logging (Winston, Pino)

## License

ISC
