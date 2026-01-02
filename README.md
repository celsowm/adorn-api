# Adorn-API

Stage-3 decorator-first OpenAPI + routing toolkit for TypeScript.

Build type-safe REST APIs with decorators. Get automatic OpenAPI 3.1 documentation, runtime validation, and authentication out of the box.

## Quick Start

```bash
npm install adorn-api
```

Create a controller:

```typescript
import { Controller, Get, Post } from "adorn-api";

interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
];

@Controller("/users")
export class UserController {
  @Get("/")
  async getUsers(): Promise<User[]> {
    return users;
  }

  @Get("/:id")
  async getUser(id: number): Promise<User | null> {
    return users.find(u => u.id === id) || null;
  }

  @Post("/")
  async createUser(body: { name: string; email: string }): Promise<User> {
    const user: User = {
      id: users.length + 1,
      name: body.name,
      email: body.email,
    };
    users.push(user);
    return user;
  }
}
```

Start your server:

```typescript
import { bootstrap } from "adorn-api/express";
import { UserController } from "./controller.js";

await bootstrap({ controllers: [UserController] });
```

Visit http://localhost:3000/docs to see your auto-generated Swagger UI.

## Features

- **Decorator-based routing** - `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
- **Automatic OpenAPI 3.1** - Generate specs from TypeScript decorators
- **Runtime validation** - AJV-powered request validation
- **Authentication** - `@Auth()` and `@Public()` decorators with custom schemes
- **Middleware** - Global, controller-level, and route-level middleware
- **Type-safe** - Full TypeScript inference throughout
- **Incremental builds** - Smart caching with `--if-stale` flag
- **Precompiled validators** - Optimized validation for production
- **Swagger UI** - Built-in documentation at `/docs`
- **Metal ORM integration** - Auto-generate schemas from entities

## Installation

```bash
npm install adorn-api
```

**Peer dependency:**

```bash
npm install express
```

**Requirements:**
- Node.js 18+
- TypeScript 5.0+

## Core Concepts

### Controllers

A controller is a class decorated with `@Controller(path)` that groups related endpoints:

```typescript
@Controller("/api/users")
export class UsersController {
  @Get("/")
  async getUsers() { /* ... */ }

  @Get("/:id")
  async getUser(id: number) { /* ... */ }
}
```

### HTTP Methods

All standard HTTP methods are supported:

```typescript
@Get("/")       // GET
@Post("/")      // POST
@Put("/:id")    // PUT
@Patch("/:id")  // PATCH
@Delete("/:id") // DELETE
```

### Parameters

Adorn-API automatically extracts parameters from your handler signatures:

```typescript
@Controller("/products")
export class ProductsController {
  @Get("/:id")
  async getProduct(
    id: number,                    // Path parameter
    query?: { category?: string }  // Query parameter
  ) { /* ... */ }

  @Post("/")
  async createProduct(
    body: { name: string },        // Request body
    headers: { "X-Request-Id": string } // Headers
  ) { /* ... */ }
}
```

### Query Objects

Use an object-typed parameter to bind flat query keys:

```typescript
import type { Query } from "adorn-api";

type Filters = {
  status?: string;
  responsavelId?: number;
};

@Get("/")
async list(query?: Query<Filters>) {
  return query;
}
```

`GET /posts?status=published&responsavelId=1`

### Deep Object Query (opt-in)

For bracketed query serialization, opt in with `@QueryStyle({ style: "deepObject" })`:

```typescript
import { QueryStyle } from "adorn-api";

type WhereFilter = {
  responsavel?: {
    perfil?: {
      nome?: string;
    };
  };
  tags?: string[];
};

@Get("/")
  @QueryStyle({ style: "deepObject" })
async list(where?: WhereFilter) {
  return where;
}
```

- `GET /posts?where[responsavel][perfil][nome]=Admin`
- `GET /posts?where[tags]=a&where[tags]=b`
- `GET /posts?where[comments][author][name]=Alice`

Notes:
- Deep object is explicit and only applies to the query object parameter on that method.
- Repeated keys become arrays (for example, `where[tags]=a&where[tags]=b`).
- The `[]` shorthand is not supported; use repeated keys instead.

## Examples

### Basic Example

Minimal API with CRUD operations. See: `examples/basic/`

```typescript
import { Controller, Get, Post, Put, Delete } from "adorn-api";

@Controller("/users")
export class UserController {
  @Get("/")
  async getUsers() { return [{ id: 1, name: "Alice" }]; }

  @Get("/:id")
  async getUser(id: number) { /* ... */ }

  @Post("/")
  async createUser(body: { name: string }) { /* ... */ }

  @Put("/:id")
  async updateUser(id: number, body: { name?: string }) { /* ... */ }

  @Delete("/:id")
  async deleteUser(id: number) { return { success: true }; }
}
```

### Authentication Example

Bearer token auth with scopes and public endpoints. See: `examples/simple-auth/`

```typescript
import { Controller, Get, Post } from "adorn-api";
import { Auth, Public } from "adorn-api/decorators";

@Controller("/api")
export class ApiController {
  @Get("/public")
  @Public()
  async publicEndpoint() {
    return { message: "No auth required" };
  }

  @Get("/profile")
  @Auth("BearerAuth")
  async getProfile(req: any) {
    return { user: req.auth };
  }

  @Get("/data")
  @Auth("BearerAuth", { scopes: ["read"] })
  async getData() {
    return { data: ["item1", "item2"] };
  }

  @Post("/items")
  @Auth("BearerAuth", { scopes: ["write"] })
  async createItem(req: any) {
    return { id: 1, name: req.body.name };
  }
}
```

Configure the auth scheme when creating your router:

```typescript
const bearerRuntime = {
  name: "BearerAuth",
  async authenticate(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    if (auth !== "Bearer valid-token") return null;
    return { principal: { userId: 1 }, scopes: ["read", "write"] };
  },
  challenge(res) {
    res.status(401).json({ error: "Unauthorized" });
  },
  authorize(auth, requiredScopes) {
    return requiredScopes.every(s => auth.scopes?.includes(s));
  },
};

await createExpressRouter({
  controllers: [ApiController],
  auth: { schemes: { BearerAuth: bearerRuntime } },
});
```

### E-commerce Example

Full CRUD with search and status management. See: `examples/ecommerce/`

```typescript
@Controller("/products")
export class ProductsController {
  @Get("/")
  async getProducts() {
    return products.filter(p => p.status === "published");
  }

  @Get("/:id")
  async getProduct(id: number) { /* ... */ }

  @Post("/")
  async createProduct(body: { name: string; price: number }) { /* ... */ }

  @Put("/:id")
  async updateProduct(id: number, body: Partial<{ name: string; price: number }>) { /* ... */ }

  @Delete("/:id")
  async deleteProduct(id: number) { return { success: true }; }

  @Post("/:id/publish")
  async publishProduct(id: number) { /* ... */ }

  @Post("/search/advanced")
  async advancedSearch(body: {
    query?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
  }) { /* ... */ }
}
```

### Blog Platform with Metal ORM

Database-driven API using Metal ORM entities. See: `examples/blog-platform-metal-orm/`

```typescript
import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { BlogPost } from "../entities/index.js";
import { getSession, selectFromEntity, eq } from "metal-orm";

@Controller("/posts")
export class PostsController {
  @Get("/")
  async getPosts(query?: { authorId?: number; status?: string }) {
    const session = getSession();
    let qb = selectFromEntity(BlogPost);
    if (query?.authorId) qb = qb.where(eq(BlogPost.authorId, query.authorId));
    if (query?.status) qb = qb.where(eq(BlogPost.status, query.status));
    return qb.execute(session);
  }

  @Get("/:id")
  async getPost(id: number) { /* ... */ }

  @Post("/")
  async createPost(body: Pick<BlogPost, "title" | "content" | "authorId">) {
    const session = getSession();
    const post = new BlogPost();
    Object.assign(post, body);
    await session.persist(post);
    await session.flush();
    return post;
  }

  @Put("/:id")
  async updatePost(id: number, body: Partial<BlogPost>) { /* ... */ }

  @Delete("/:id")
  async deletePost(id: number) { return { success: true }; }
}
```

### Task Manager Example

Multi-controller architecture with SQL database. See: `examples/task-manager/`

```typescript
@Controller("/tasks")
export class TasksController {
  @Get("/")
  async getTasks(query?: { status?: string; priority?: string; search?: string }) {
    let sql = "SELECT * FROM tasks WHERE 1=1";
    if (query?.status) sql += " AND status = ?";
    return allQuery(sql, params);
  }

  @Get("/:id")
  async getTask(id: number) { /* returns task with tags */ }

  @Post("/")
  async createTask(body: { title: string; priority?: "low" | "medium" | "high" }) {
    const now = new Date().toISOString();
    return runQuery(sql, [...values, now, now]);
  }

  @Put("/:id")
  async updateTask(id: number, body: Partial<Task>) { /* ... */ }

  @Delete("/:id")
  async deleteTask(id: number) { return { success: result.changes > 0 }; }

  @Post("/:id/tags")
  async addTagToTask(id: number, body: { tag_id: number }) { /* ... */ }
}

@Controller("/tags")
export class TagsController {
  @Get("/")
  async getTags() { return allQuery("SELECT * FROM tags"); }

  @Post("/")
  async createTag(body: { name: string; color?: string }) { /* ... */ }
}

@Controller("/stats")
export class StatsController {
  @Get("/")
  async getStats() {
    return {
      total: count,
      byStatus: statusMap,
      byPriority: priorityMap,
    };
  }
}
```

## Authentication

### @Auth Decorator

Protect endpoints with authentication requirements:

```typescript
@Controller("/api")
export class ApiController {
  @Get("/secure")
  @Auth("BearerAuth")
  async secureEndpoint(req: any) {
    return { user: req.auth };
  }

  @Get("/with-scopes")
  @Auth("BearerAuth", { scopes: ["read", "write"] })
  async scopedEndpoint() {
    return { data: "secret" };
  }

  @Get("/optional")
  @Auth("BearerAuth", { optional: true })
  async optionalAuth(req: any) {
    return { user: req.auth }; // null if no token
  }
}
```

### @Public Decorator

Mark endpoints as publicly accessible (bypasses auth):

```typescript
@Controller("/api")
export class ApiController {
  @Get("/public")
  @Public()
  async publicEndpoint() {
    return { message: "Anyone can access this" };
  }

  @Get("/protected")
  @Auth("BearerAuth")
  async protectedEndpoint() {
    return { message: "Auth required" };
  }
}
```

### Auth Scheme Configuration

Define custom authentication schemes:

```typescript
const jwtRuntime = {
  name: "JwtAuth",
  async authenticate(req) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return null;
    try {
      const payload = verify(token, process.env.JWT_SECRET!);
      return { principal: payload, scopes: payload.scopes || [] };
    } catch {
      return null;
    }
  },
  challenge(res) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="api"');
    res.status(401).json({ error: "Invalid token" });
  },
  authorize(auth, requiredScopes) {
    return requiredScopes.every(s => auth.scopes.includes(s));
  },
};

await createExpressRouter({
  controllers: [ApiController],
  auth: { schemes: { JwtAuth: jwtRuntime } },
});
```

## Middleware

Adorn-API supports middleware at three levels: global, controller, and route.

### Global Middleware

Apply middleware to all routes:

```typescript
await createExpressRouter({
  controllers: [ControllerA, ControllerB],
  middleware: {
    global: [loggingMw, corsMw],
  },
});
```

### Controller-Level Middleware

Use `@Use` on a controller class:

```typescript
@Controller("/api")
@Use(controllerMw)
export class ApiController {
  @Get("/")
  async getData() { /* global, controller, then handler */ }
}
```

### Route-Level Middleware

Use `@Use` on individual methods:

```typescript
@Controller("/api")
export class ApiController {
  @Get("/")
  @Use(routeMw)
  async getData() { /* global, controller, route, then handler */ }
}
```

Middleware execution order: `global` → `controller` → `route` → `handler`

### Named Middleware

Register middleware by name for reuse:

```typescript
const rateLimiter = (req: any, res: any, next: any) => {
  // rate limiting logic
  next();
};

await createExpressRouter({
  controllers: [ApiController],
  middleware: {
    named: { rateLimiter },
  },
});
```

```typescript
@Controller("/api")
export class ApiController {
  @Get("/")
  @Use("rateLimiter")
  async getData() { /* uses named middleware */ }
}
```

## Schema & Validation

### Schema Decorators

Apply validation rules to object properties:

```typescript
import { Schema, Min, Max, MinLength, MaxLength, Pattern, Enum } from "adorn-api/schema";

class CreateUserRequest {
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @Pattern("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
  email: string;

  @Min(18)
  @Max(120)
  age: number;

  @Enum(["admin", "user", "guest"])
  role: "admin" | "user" | "guest";
}
```

Available decorators:

| Decorator | Purpose |
|-----------|---------|
| `@Min(n)` | Minimum numeric value |
| `@Max(n)` | Maximum numeric value |
| `@ExclusiveMin(n)` | Exclusive minimum |
| `@ExclusiveMax(n)` | Exclusive maximum |
| `@MinLength(n)` | Minimum string/array length |
| `@MaxLength(n)` | Maximum string/array length |
| `@Pattern(regex)` | Regex pattern match |
| `@Format(fmt)` | Format validation (email, uuid, etc.) |
| `@MinItems(n)` | Minimum array items |
| `@MaxItems(n)` | Maximum array items |
| `@MinProperties(n)` | Minimum object properties |
| `@MaxProperties(n)` | Maximum object properties |
| `@MultipleOf(n)` | Numeric multiple |
| `@Enum([...])` | Enumeration values |
| `@Const(value)` | Constant value |
| `@Default(value)` | Default value |
| `@Example(value)` | Example value for docs |
| `@Description(text)` | Property description |
| `@Closed()` | No additional properties |
| `@ClosedUnevaluated()` | Unevaluated properties not allowed |

### Validation Modes

Control how validation runs:

**Runtime (default):**

```bash
adorn-api build --validation-mode ajv-runtime
```

**Precompiled (production-optimized):**

```bash
adorn-api build --validation-mode precompiled
```

Generates optimized validator modules for faster startup.

**Disabled:**

```bash
adorn-api build --validation-mode none
```

## CLI Reference

### Build Command

Generate OpenAPI spec and manifest from TypeScript source:

```bash
adorn-api build -p ./tsconfig.json --output .adorn
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-p <path>` | Path to tsconfig.json | `./tsconfig.json` |
| `--output <dir>` | Output directory | `.adorn` |
| `--if-stale` | Only rebuild if stale | `false` |
| `--validation-mode <mode>` | Validation mode | `ajv-runtime` |

**Validation modes:** `none`, `ajv-runtime`, `precompiled`

### Clean Command

Remove generated artifacts:

```bash
adorn-api clean --output .adorn
```

### Incremental Builds

Use `--if-stale` for efficient rebuilds:

```bash
adorn-api build --if-stale
```

Only rebuilds when:
- Controller source files changed
- TypeScript version changed
- Adorn-API version changed

## API Reference

### bootstrap()

Quick server setup with sensible defaults:

```typescript
import { bootstrap } from "adorn-api/express";

await bootstrap({
  controllers: [UserController],
  port?: number,              // Default: 3000 or PORT env
  host?: string,              // Default: "0.0.0.0" or HOST env
  artifactsDir?: string,      // Default: ".adorn"
  enableSwagger?: boolean,    // Default: true
  swaggerPath?: string,       // Default: "/docs"
  swaggerJsonPath?: string,   // Default: "/docs/openapi.json"
  middleware?: CreateRouterOptions["middleware"],
  auth?: CreateRouterOptions["auth"],
  coerce?: CreateRouterOptions["coerce"],
});
```

**Returns:** `{ server, app, url, port, host, close }`

### createExpressRouter()

Full control over router creation:

```typescript
import { createExpressRouter } from "adorn-api/express";

const router = await createExpressRouter({
  controllers: [UserController],
  artifactsDir?: string,      // Default: ".adorn"
  manifest?: ManifestV1,      // Auto-loaded if not provided
  openapi?: OpenAPI31,        // Auto-loaded if not provided
  auth?: {
    schemes: Record<string, AuthSchemeRuntime>,
  },
  coerce?: {
    body?: boolean,
    query?: boolean,
    path?: boolean,
    header?: boolean,
    cookie?: boolean,
    dateTime?: boolean,
    date?: boolean,
  },
  middleware?: {
    global?: Middleware[],
    named?: Record<string, Middleware>,
  },
});
```

Date properties in TypeScript map to OpenAPI `type: "string"` with `format: "date-time"`. Enable `coerce` to convert ISO 8601 date-time strings into `Date` instances before your handler runs. For date-only strings, use `@Format("date")` and keep `date` coercion off to avoid timezone shifts. You can disable per-field coercion with `@Schema({ "x-adorn-coerce": false })`.

### setupSwagger()

Add Swagger UI to any Express app:

```typescript
import { setupSwagger } from "adorn-api/express";

app.use(setupSwagger({
  artifactsDir?: string,      // Default: ".adorn"
  jsonPath?: string,          // Default: "/docs/openapi.json"
  uiPath?: string,            // Default: "/docs"
  swaggerOptions?: {
    servers?: [{ url: string }],
    // Other Swagger UI options
  },
}));
```

## Why Adorn-API?

| Feature | Adorn-API | tsoa | NestJS |
|---------|-----------|------|--------|
| Decorator-first | Yes | Yes | Yes |
| OpenAPI 3.1 | Yes | Yes | Yes |
| No transpilation | Yes | No | No |
| Incremental builds | Yes | No | No |
| Precompiled validators | Yes | No | No |
| Stage-3 decorators | Yes | Stage 2 | Custom |
| Learning curve | Low | Medium | High |
| Framework agnostic | Yes | Partial | No |
| Metal ORM integration | Yes | No | No |

### What Makes Adorn-API Different

**Stage-3 Decorators:** Uses the official TC39 decorators proposal (ES2024), not legacy TypeScript experimental decorators. This means no build-time transformer is required—your decorators compile directly to metadata that Adorn-API reads at runtime.

**No Transpilation Needed:** Unlike tsoa, Adorn-API doesn't require a custom TypeScript transformer. Controllers are regular TypeScript classes that work with native decorators.

**Incremental Builds:** The `--if-stale` flag intelligently determines when rebuilds are needed, caching TypeScript program states for fast iteration.

**Precompiled Validators:** Generate optimized validation modules at build time for production deployments where startup time matters.

**Framework Agnostic:** While Express is the primary adapter, the core is adapter-based and could support other frameworks in the future.

## Metal ORM Integration

Adorn-API can auto-generate OpenAPI schemas from Metal ORM entities:

```typescript
import { Controller, Get } from "adorn-api";
import { User } from "./entities/index.js";
import { registerMetalEntities } from "adorn-api/metal";

@Controller("/users")
export class UsersController {
  @Get("/")
  async getUsers(): Promise<User[]> {
    return session.find(User);
  }
}

// Auto-generate schema from entity
const openapi = { /* base openapi */ };
registerMetalEntities(openapi, [User], { stripEntitySuffix: true });
```

Options:
- `mode`: `"read"` or `"create"` (excludes auto-generated columns)
- `stripEntitySuffix`: Remove `_Entity` suffix from schema names

## Project Structure

```
my-api/
├── src/
│   ├── controller.ts      # Your controllers
│   └── server.ts          # Entry point
├── .adorn/                # Generated artifacts (gitignored)
│   ├── openapi.json       # OpenAPI spec
│   ├── manifest.json      # Route manifest
│   └── cache.json         # Build cache
├── tsconfig.json
└── package.json
```

## License

MIT
