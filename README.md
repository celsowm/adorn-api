# Adorn API

A TypeScript API framework using **Standard TC39 Decorators** (not experimental decorators) to build type-safe, self-documenting APIs with automatic OpenAPI/Swagger generation.

## Features

- ✅ **Standard Decorators**: Uses TC39 Stage 3 decorators (no experimental flags needed)
- ✅ **Type-Safe DTOs**: Full TypeScript type checking at edit time
- ✅ **Automatic Swagger Generation**: Generates OpenAPI 3.0 documentation from your code
- ✅ **Runtime Route Generation**: Automatically creates Express routes
- ✅ **Configurable CLI**: Single configuration file for all generation options
- ✅ **Proper HTTP Status Codes**: Returns 200/201/204 based on HTTP verb, with `@Status` overrides
- ✅ **Path Normalization**: Handles route paths correctly (e.g., `{id}` → `:id`)
- ✅ **Inheritance Support**: Extend base DTO classes with full type information
- ✅ **Generic Response Types**: `EntityResponse<T>`, `CreateInput<T>`, etc.
- ✅ **Authentication**: Built-in `@Authorized` decorator with adapter support
- ✅ **Auth Adapter**: Pluggable authentication middleware system
- ✅ **DTO Factory**: Configurable DTO instantiation (plain objects or class instances)
- ✅ **Error Adapter**: Custom error transformation before reaching error handlers
- ✅ **Controller-Only Scan**: Optional separate glob for swagger generation
- ✅ **Multiple Parameters**: Support for multiple method parameters beyond single DTO
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

## Configuration

Create an `adorn.config.ts` file in your project root:

```typescript
import type { AdornConfig } from "./src/lib/config.js";

const config: AdornConfig = {
  // Project configuration
  tsConfig: "./tsconfig.json",
  
  // Controller discovery
  controllersGlob: "**/*.controller.ts",
  swaggerControllersGlob: "**/*.controller.ts", // Optional: separate glob for swagger
  
  // Route generation
  routesOutput: "./src/routes.ts",
  basePath: "", // Optional global base path (e.g., "/api/v1")
  
  // Swagger generation
  swaggerOutput: "./swagger.json",
  swaggerInfo: {
    title: "My API",
    version: "1.0.0",
    description: "API documentation",
  },
  
  // Middleware paths (relative to output directory)
  authMiddlewarePath: "./middleware/auth.middleware.js",
  
  // Phase 2: Adapter configuration
  useClassInstantiation: false, // If true, DTOs will be instantiated as classes
  errorAdapterPath: undefined, // Optional: Path to custom error adapter
};

export default config;
```

Then run generation:
```bash
npx adorn-api gen
```

Or use the CLI options:
```bash
npx adorn-api gen --config path/to/config.ts
npx adorn-api gen --swagger  # Generate only Swagger
npx adorn-api gen --routes   # Generate only routes
```

## Phase 2 Features

### Auth Adapter

The `@Authorized` decorator now supports a pluggable adapter system, allowing you to use custom authentication middleware instead of the hard-coded path.

#### Using the Default Auth Adapter

```typescript
// adorn.config.ts
const config: AdornConfig = {
  // ... other config
  authMiddlewarePath: "./middleware/auth.middleware.js",
};
```

```typescript
// middleware/auth.middleware.js
export function authenticationMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Validate token and set req.user
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}
```

#### Using a Custom Auth Adapter

```typescript
// src/adapters/custom-auth.adapter.ts
import type { AuthAdapter, Request, Response, NextFunction } from 'adorn-api';

export class CustomAuthAdapter implements AuthAdapter {
  getMiddleware(role?: string): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
      // Custom auth logic
      console.log(`Authenticating with role: ${role}`);
      next();
    };
  }
}
```

### DTO Factory

Configure how DTOs are instantiated - either as plain objects (default) or as class instances.

#### Plain Objects (Default)

```typescript
// adorn.config.ts
const config: AdornConfig = {
  useClassInstantiation: false, // Default
};
```

```typescript
// Controller method
public async createUser(dto: CreateUserDto) {
  // dto is a plain object
  console.log(dto); // { name: 'John', email: 'john@example.com' }
}
```

#### Class Instances

```typescript
// adorn.config.ts
const config: AdornConfig = {
  useClassInstantiation: true,
};
```

```typescript
// DTO with defaults and methods
class CreateUserDto {
  @FromBody()
  name!: string;
  
  @FromBody()
  email!: string;
  
  // Default values will be applied
  role = 'user';
  
  // Class methods will work
  isValid() {
    return this.email.includes('@');
  }
}

// Controller method
public async createUser(dto: CreateUserDto) {
  // dto is a class instance
  console.log(dto.role); // 'user'
  console.log(dto.isValid()); // true
}
```

### Error Adapter

Transform errors before they reach your error handlers.

```typescript
// src/adapters/error.adapter.ts
import type { ErrorAdapter } from 'adorn-api';

export class CustomErrorAdapter implements ErrorAdapter {
  handleError(err: Error): Error {
    // Add status code if missing
    if (!(err as any).statusCode) {
      (err as any).statusCode = 500;
    }
    
    // Clean sensitive information
    if (process.env.NODE_ENV === 'production') {
      err.message = 'An error occurred';
    }
    
    return err;
  }
}
```

```typescript
// adorn.config.ts
const config: AdornConfig = {
  errorAdapterPath: "./src/adapters/error.adapter.js",
};
```

### Multiple Parameters

Controller methods can now accept multiple parameters beyond the single DTO pattern.

```typescript
@Controller("users")
export class UserController {
  // Multiple parameters: DTO + req + id
  @Post("/{userId}/update")
  public async updateUser(
    dto: UpdateUserDto,
    req: Request,
    userId: string
  ): Promise<User> {
    // dto is mapped from req.body
    // req is the Express request object
    // userId is mapped from req.params.userId
    console.log(req.user); // Access user from auth middleware
    return this.userService.update(userId, dto);
  }
  
  // Multiple DTOs
  @Post("/batch")
  public async batchCreate(
    user1: CreateUserDto,
    user2: CreateUserDto
  ): Promise<User[]> {
    // Both DTOs are mapped from req.body
    return [user1, user2];
  }
}
```

### Controller-Only Swagger Scan

Use a separate glob pattern for swagger generation to avoid scanning unrelated files.

```typescript
// adorn.config.ts
const config: AdornConfig = {
  // Route generation: scans all controllers
  controllersGlob: "src/controllers/**/*.ts",
  
  // Swagger generation: only scans public API controllers
  swaggerControllersGlob: "src/controllers/public/**/*.ts",
};
```

This is useful when you have:
- Internal controllers that shouldn't be documented
- Admin endpoints in a separate directory
- Test controllers that shouldn't appear in swagger

## TC39 Decorator Checklist

To use standard TC39 decorators with TypeScript, ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    // Do NOT enable these:
    // "experimentalDecorators": false,  // Should be false or omitted
    // "emitDecoratorMetadata": false  // Should be false (standard decorators don't use this)
  }
}
```

**Important:**
- ❌ **Do NOT** enable `experimentalDecorators` (legacy decorators)
- ❌ **Do NOT** enable `emitDecoratorMetadata` (not needed for standard decorators)
- ✅ **Do** use `target: ES2022` or higher
- ✅ **Do** use `"module": "NodeNext"` for ESM support

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
