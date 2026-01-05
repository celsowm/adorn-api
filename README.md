# Adorn-API

A Stage-3 decorator-first OpenAPI + routing toolkit for Express with full TypeScript support.

## Features

- **Decorators-First**: Use Stage-3 decorators to define controllers, routes, middleware, and auth
- **Auto-Generated OpenAPI**: OpenAPI 3.1 specs generated from your TypeScript types
- **Swagger UI**: Interactive API documentation at `/docs` with zero configuration
- **Type-Safe**: Full TypeScript inference throughout your API
- **Authentication**: Built-in auth support with scope-based authorization
- **Middleware**: Apply middleware globally, per-controller, or per-route
- **Metal-ORM Integration**: Seamless database integration with type-safe queries
- **Validation**: AJV runtime validation with optional precompiled validators
- **Hot Reload**: Development mode with automatic rebuilds

## Installation

```bash
npm install adorn-api
npm install -D @types/express
```

## Quick Start

```typescript
// controller.ts
import { Controller, Get, Post } from "adorn-api";

interface User {
  id: number;
  name: string;
  email: string;
}

@Controller("/users")
export class UserController {
  @Get("/")
  async getUsers(): Promise<User[]> {
    return [{ id: 1, name: "Alice", email: "alice@example.com" }];
  }

  @Post("/")
  async createUser(body: { name: string; email: string }): Promise<User> {
    return { id: 2, name: body.name, email: body.email };
  }
}
```

```typescript
// server.ts
import { bootstrap } from "adorn-api/express";
import { UserController } from "./controller.js";

await bootstrap({
  controllers: [UserController],
});
```

Run with:

```bash
npx adorn-api dev
```

Open http://localhost:3000/docs to see your Swagger UI documentation.

## Core Concepts

### Controllers

Define a controller with a base path:

```typescript
@Controller("/api/users")
export class UserController {}
```

### Route Handlers

Use HTTP method decorators to define routes:

```typescript
@Controller("/users")
export class UserController {
  @Get("/")
  async list(): Promise<User[]> {}

  @Get("/:id")
  async get(id: number): Promise<User> {}

  @Post("/")
  async create(body: CreateUserDto): Promise<User> {}

  @Put("/:id")
  async update(id: number, body: UpdateUserDto): Promise<User> {}

  @Patch("/:id")
  async patch(id: number, body: Partial<User>): Promise<User> {}

  @Delete("/:id")
  async delete(id: number): Promise<void> {}
}
```

### Parameters

Parameters are automatically extracted from your handler signature:

```typescript
async handler(
  id: number,        // Path parameter
  query: { limit?: number; sort?: string },  // Query parameters
  body: CreateUserDto,  // Request body
  headers: { authorization?: string },  // Headers
  cookies: { sessionId?: string }  // Cookies
) {}
```

### Middleware

Apply middleware at any level:

```typescript
// Global middleware
const app = await bootstrap({
  controllers: [UserController],
  middleware: {
    global: [loggingMiddleware, corsMiddleware],
    named: { auth: authMiddleware },
  },
});

// Controller-level middleware
@Controller("/users")
@Use(authMiddleware)
export class UserController {}

// Route-level middleware
@Get("/admin")
@Use(adminMiddleware)
async adminOnly() {}

// Named middleware
@Get("/protected")
@Use("auth")
async protected() {}
```

Middleware executes in order: global → controller → route → handler.

### Authentication

Define auth schemes and protect routes:

```typescript
import { Auth, Public } from "adorn-api";

// Define auth scheme
const bearerRuntime = {
  name: "BearerAuth",
  async authenticate(req: any) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await verifyToken(token);
    return user ? { principal: user, scopes: user.scopes } : null;
  },
  challenge(res: any) {
    res.status(401).json({ error: "Unauthorized" });
  },
  authorize(auth: any, requiredScopes: string[]) {
    return requiredScopes.every(s => auth.scopes?.includes(s));
  },
};

// Bootstrap with auth
await bootstrap({
  controllers: [UserController],
  auth: {
    schemes: { BearerAuth: bearerRuntime },
  },
});

// Protect routes
@Controller("/api")
export class ApiController {
  @Get("/public")
  @Public()
  async publicEndpoint() {}

  @Get("/profile")
  @Auth("BearerAuth")
  async getProfile() {}

  @Post("/admin")
  @Auth("BearerAuth", { scopes: ["admin"] })
  async adminOnly() {}
}
```

### Optional Authentication

```typescript
@Get("/resource")
@Auth("BearerAuth", { optional: true })
async getResource(req: any) {
  if (req.auth) {
    return { user: req.auth.principal };
  }
  return { user: null };
}
```

## Metal-ORM Integration

Seamlessly integrate with Metal-ORM for database operations:

```typescript
import { Controller, Get } from "adorn-api";
import type { ListQuery } from "adorn-api/metal";
import { applyListQuery } from "adorn-api/metal";
import { selectFromEntity, entityRef } from "metal-orm";

@Controller("/tasks")
export class TasksController {
  @Get("/")
  async list(query: ListQuery<Task>): Promise<PaginatedResult<Task>> {
    const session = getSession();
    const T = entityRef(Task);

    const qb = selectFromEntity(Task)
      .select("id", "title", "completed")
      .where(eq(T.completed, false));

    return applyListQuery(qb, session, query);
  }
}
```

`ListQuery` supports:
- Pagination: `page`, `perPage`
- Sorting: `sort` (string or array, prefix with `-` for DESC)
- Filtering: `where` (deep object filters)

### Register Metal Entities

Auto-generate OpenAPI schemas from Metal-ORM entities:

```typescript
import { registerMetalEntities } from "adorn-api/metal";
import { User, Post, Comment } from "./entities/index.js";

registerMetalEntities(openapi, [User, Post, Comment], {
  mode: "read",
  stripEntitySuffix: true,
  includeRelations: "inline",
});
```

## Examples

The repository includes several examples demonstrating different features:

### [Basic](examples/basic/)
Simple CRUD API with GET, POST endpoints and in-memory data.

```bash
npm run example basic
```

### [Simple Auth](examples/simple-auth/)
Authentication with bearer tokens, scope-based authorization, public/protected endpoints.

```bash
npm run example simple-auth
```

### [Task Manager](examples/task-manager/)
Complete task management API with SQLite3, filtering, tags, and statistics.

```bash
npm run example task-manager
```

### [Three Controllers](examples/three-controllers/)
Multiple controllers (Users, Posts, Comments) in a blog application.

```bash
npm run example three-controllers
```

### [Blog Platform (Metal-ORM)](examples/blog-platform-metal-orm/)
Full-featured blog platform with Metal-ORM, relationships, and advanced queries.

```bash
npm run example blog-platform-metal-orm
```

### [E-commerce](examples/ecommerce/)
E-commerce API with RESTful and non-RESTful endpoints, carts, orders, and coupons.

```bash
npm run example ecommerce
```

### [Simple Pagination (Metal-ORM)](examples/simple-pagination-metal-orm/)
Pagination and sorting with Metal-ORM integration.

```bash
npm run example simple-pagination-metal-orm
```

### [Query JSON (Metal-ORM)](examples/query-json-metal-orm/)
Advanced filtering with deep object query parameters.

```bash
npm run example query-json-metal-orm
```

## CLI

### Development

```bash
npx adorn-api dev
```

Builds artifacts and starts server with hot-reload.

### Build

```bash
npx adorn-api build
```

Generates `.adorn/` directory with:
- `openapi.json` - OpenAPI 3.1 specification
- `manifest.json` - Runtime binding metadata
- `cache.json` - Build cache for incremental rebuilds
- `validator.js` - Precompiled validators (if enabled)

### Run Examples

```bash
# List all examples
npm run example:list

# Run specific example
npm run example basic
npm run example blog-platform-metal-orm
```

## API Reference

### Decorators

- `@Controller(path)` - Define a controller with base path
- `@Get(path)` - GET route handler
- `@Post(path)` - POST route handler
- `@Put(path)` - PUT route handler
- `@Patch(path)` - PATCH route handler
- `@Delete(path)` - DELETE route handler
- `@Use(...middleware)` - Apply middleware
- `@Auth(scheme, options)` - Require authentication
- `@Public()` - Mark route as public (bypasses auth)

### Exports

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Use,
  Auth,
  Public,
} from "adorn-api";

import {
  bootstrap,
  createExpressRouter,
  setupSwagger,
} from "adorn-api/express";

import {
  ListQuery,
  applyListQuery,
  registerMetalEntities,
} from "adorn-api/metal";

import { readAdornBucket } from "adorn-api";
import type { AdornBucket, AuthSchemeRuntime, AuthResult } from "adorn-api";
```

### Bootstrap Options

```typescript
await bootstrap({
  controllers: [UserController, PostController],
  auth: {
    schemes: {
      BearerAuth: bearerRuntime,
      ApiKey: apiKeyRuntime,
    },
  },
  middleware: {
    global: [logger, cors],
    named: { auth: authMiddleware },
  },
  port: 3000,
  host: "0.0.0.0",
});
```

### Auth Scheme

```typescript
const authScheme: AuthSchemeRuntime = {
  name: "MyAuth",
  async authenticate(req: any) {
    return { principal: user, scopes: ["read", "write"] };
  },
  challenge(res: any) {
    res.status(401).json({ error: "Unauthorized" });
  },
  authorize(auth: any, requiredScopes: string[]) {
    return requiredScopes.every(s => auth.scopes?.includes(s));
  },
};
```

## Validation

Adorn-API supports two validation modes:

### Runtime Validation (AJV)

```typescript
await bootstrap({
  controllers: [UserController],
  validation: {
    mode: "ajv-runtime",
  },
});
```

### Precompiled Validators

```typescript
await bootstrap({
  controllers: [UserController],
  validation: {
    mode: "precompiled",
  },
});
```

Precompiled validators are generated at build time in `.adorn/validator.js` for better performance.

## Testing

Tests are written with Vitest and cover:

- Compiler schema generation
- Decorator metadata
- Express integration
- Middleware execution order
- Authentication and authorization
- Metal-ORM integration

```bash
npm test
```

### Test Structure

```
test/
├── integration/        # Express integration tests
├── compiler/          # Schema and manifest generation
├── runtime/            # Decorator metadata
├── middleware/         # Middleware ordering and auth
├── metal/             # Metal-ORM integration
└── fixtures/          # Test fixtures
```

## Configuration

### TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Vitest Config

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
    },
  },
});
```

## How It Works

1. **Compile**: The CLI analyzes your TypeScript controllers and extracts metadata using the compiler API
2. **Generate**: OpenAPI schemas and runtime manifests are generated from type information
3. **Bind**: At runtime, metadata is merged with controller instances to bind routes to Express
4. **Validate**: Optional validation ensures requests match your TypeScript types
5. **Document**: Swagger UI serves interactive documentation based on generated OpenAPI spec

## License

MIT
