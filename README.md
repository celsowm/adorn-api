# Adorn API

A modern, decorator-first web framework built on Express with built-in OpenAPI 3.1 schema generation, designed for rapid API development with excellent Type safety and developer experience.

## Features

- ✨ **Decorator-First API Definition**: Define controllers and DTOs with intuitive decorators
- 📚 **Automatic OpenAPI 3.1 Generation**: API documentation is generated from your code
- 🔌 **Express Integration**: Built on top of Express for familiarity and extensibility
- 🎯 **Type-Safe Data Transfer Objects**: Define schemas with TypeScript for compile-time checks
- 🔄 **DTO Composition**: Reuse and compose DTOs with PickDto, OmitDto, PartialDto, and MergeDto
- 📦 **Metal ORM Integration**: First-class support for Metal ORM with auto-generated CRUD DTOs
- 🚀 **Streaming Support**: Server-Sent Events (SSE) and streaming responses
- 📝 **Request Validation**: Automatic validation of request bodies, params, query, and headers
- 🔒 **Error Handling**: Structured error responses with error DTO support
- 💾 **File Uploads**: Easy handling of file uploads with multipart form data
- 🌐 **CORS Support**: Built-in CORS configuration
- 🏗️ **Lifecycle Hooks**: Application bootstrap and shutdown lifecycle events

## Installation

```bash
npm install adorn-api
```

## Quick Start

### 1. Define DTOs

```typescript
// user.dtos.ts
import { Dto, Field, OmitDto, PickDto, t } from "adorn-api";

@Dto({ description: "User record returned by the API." })
export class UserDto {
  @Field(t.uuid({ description: "User identifier." }))
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.string()))
  nickname?: string;
}

@OmitDto(UserDto, ["id"])
export class CreateUserDto {}

@PickDto(UserDto, ["id"])
export class UserParamsDto {}
```

### 2. Create a Controller

```typescript
// user.controller.ts
import {
  Body,
  Controller,
  Get,
  Params,
  Post,
  Returns,
  type RequestContext
} from "adorn-api";
import { CreateUserDto, UserDto, UserParamsDto } from "./user.dtos";

@Controller("/users")
export class UserController {
  @Get("/:id")
  @Params(UserParamsDto)
  @Returns(UserDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    return {
      id: ctx.params.id,
      name: "Ada Lovelace",
      nickname: "Ada"
    };
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto, description: "Created" })
  async create(ctx: RequestContext<CreateUserDto>) {
    return {
      id: "3f0f4d0f-1cb1-4cf1-9c32-3d4bce1b3f36",
      name: ctx.body.name,
      nickname: ctx.body.nickname
    };
  }
}
```

### 3. Bootstrap the Application

```typescript
// app.ts
import { createExpressApp } from "adorn-api";
import { UserController } from "./user.controller";

export async function createApp() {
  return createExpressApp({
    controllers: [UserController],
    openApi: {
      info: {
        title: "Adorn API",
        version: "1.0.0"
      },
      docs: true
    }
  });
}

// index.ts
import { createApp } from "./app";

async function start() {
  const app = await createApp();
  const PORT = 3000;
  
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`OpenAPI documentation: http://localhost:${PORT}/openapi.json`);
  });
}

start().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
```

## Core Concepts

### Controllers

Controllers are classes decorated with `@Controller()` that group related API endpoints. Each controller has a base path and contains route handlers.

```typescript
@Controller("/api/v1/users")
export class UserController {
  // Routes go here
}
```

### Routes

Routes are methods decorated with HTTP verb decorators like `@Get()`, `@Post()`, `@Put()`, `@Patch()`, or `@Delete()`.

```typescript
@Get("/:id")
@Params(UserParamsDto)
@Returns(UserDto)
async getOne(ctx: RequestContext) {
  // Route handler logic
}
```

### DTOs (Data Transfer Objects)

DTOs define the shape of data sent to and from your API. They provide validation, documentation, and type safety.

```typescript
@Dto({ description: "User data" })
export class UserDto {
  @Field(t.uuid({ description: "Unique identifier" }))
  id!: string;

  @Field(t.string({ minLength: 2, maxLength: 100 }))
  name!: string;
}
```

### Request Context

Each route handler receives a `RequestContext` object that provides access to:
- `ctx.body` - The request body (validated and typed)
- `ctx.params` - Route parameters
- `ctx.query` - Query parameters
- `ctx.headers` - Request headers
- `ctx.req` - The raw Express request
- `ctx.res` - The raw Express response
- `ctx.sse` - SSE emitter (for SSE routes)
- `ctx.stream` - Streaming writer (for streaming routes)

## Advanced Features

### Server-Sent Events (SSE)

```typescript
import { Controller, Get, Sse } from "adorn-api";

@Controller("/events")
class EventsController {
  @Get("/")
  @Sse({ description: "Real-time events stream" })
  async streamEvents(ctx: any) {
    const emitter = ctx.sse;
    
    let count = 0;
    const interval = setInterval(() => {
      count++;
      emitter.emit("message", {
        id: count,
        timestamp: new Date().toISOString(),
        message: `Event ${count}`
      });

      if (count >= 5) {
        clearInterval(interval);
        emitter.close();
      }
    }, 1000);

    ctx.req.on("close", () => {
      clearInterval(interval);
      emitter.close();
    });
  }
}
```

### Streaming Responses

```typescript
import { Controller, Get, Streaming } from "adorn-api";

@Controller("/streaming")
class StreamingController {
  @Get("/")
  @Streaming({ contentType: "text/plain" })
  async streamText(ctx: any) {
    const writer = ctx.stream;
    const data = ["First line", "Second line", "Third line"];
    
    for (let i = 0; i < data.length; i++) {
      writer.writeLine(data[i]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    writer.close();
  }
}
```

### File Uploads

```typescript
import { Controller, Post, UploadedFile, Returns, t } from "adorn-api";

@Controller("/uploads")
class UploadController {
  @Post("/")
  @UploadedFile("file", t.file({ accept: ["image/*"], maxSize: 5 * 1024 * 1024 }))
  @Returns({ status: 200, schema: t.string() })
  async uploadFile(ctx: any) {
    const file = ctx.files?.file[0];
    return `File uploaded: ${file.originalname}`;
  }
}
```

## Metal ORM Integration

Adorn API has first-class support for Metal ORM, providing automatic CRUD DTO generation.

### 1. Define Entities

```typescript
// user.entity.ts
import { Entity, PrimaryKey, Property } from "metal-orm";

@Entity("users")
export class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ nullable: true })
  nickname?: string;
}
```

### 2. Generate CRUD DTOs

```typescript
// user.dtos.ts
import { createMetalCrudDtoClasses } from "adorn-api";
import { User } from "./user.entity";

export const {
  GetUserDto,
  CreateUserDto,
  UpdateUserDto,
  ReplaceUserDto,
  UserQueryDto,
  UserPagedResponseDto
} = createMetalCrudDtoClasses(User);
```

### 3. Create a CRUD Controller

```typescript
// user.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Params,
  Body,
  Query,
  Returns,
  parsePagination,
  type RequestContext
} from "adorn-api";
import { applyFilter, toPagedResponse } from "metal-orm";
import { createSession } from "./db";
import { User } from "./user.entity";
import {
  GetUserDto,
  CreateUserDto,
  UpdateUserDto,
  ReplaceUserDto,
  UserQueryDto,
  UserPagedResponseDto
} from "./user.dtos";

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    const { page, pageSize } = parsePagination(ctx.query);
    const session = createSession();
    
    try {
      const query = applyFilter(
        User.select().orderBy(User.id, "ASC"),
        User,
        ctx.query
      );
      
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    } finally {
      await session.dispose();
    }
  }

  @Get("/:id")
  @Params({ id: t.integer() })
  @Returns(GetUserDto)
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const session = createSession();
    
    try {
      const user = await session.find(User, parseInt(ctx.params.id));
      return user;
    } finally {
      await session.dispose();
    }
  }

  // Other CRUD operations...
}
```

## Configuration

### Express App Options

```typescript
createExpressApp({
  // Required
  controllers: [UserController],
  
  // Optional
  cors: true, // Enable CORS with default options or configure
  jsonBody: true, // Parse JSON bodies (default: true)
  inputCoercion: "safe", // Input coercion mode ("safe" or "strict")
  multipart: { // File upload configuration
    dest: "./uploads",
    limits: { fileSize: 50 * 1024 * 1024 }
  },
  openApi: {
    info: {
      title: "My API",
      version: "1.0.0",
      description: "API documentation"
    },
    path: "/openapi.json", // OpenAPI schema endpoint
    docs: true // Serve Swagger UI
  }
});
```

## Schema Types

The `t` object provides a rich set of schema types:

- Primitives: `t.string()`, `t.number()`, `t.integer()`, `t.boolean()`
- Formats: `t.uuid()`, `t.dateTime()`
- Complex: `t.array()`, `t.object()`, `t.record()`
- Combinators: `t.union()`, `t.enum()`, `t.literal()`
- Special: `t.ref()`, `t.any()`, `t.null()`, `t.file()`
- Modifiers: `t.optional()`, `t.nullable()`

## DTO Composition

Reuse and compose DTOs with these decorators:

```typescript
// Pick specific fields from an existing DTO
@PickDto(UserDto, ["id", "name"])
export class UserSummaryDto {}

// Omit specific fields from an existing DTO
@OmitDto(UserDto, ["password"])
export class PublicUserDto {}

// Make all fields optional
@PartialDto(UserDto)
export class UpdateUserDto {}

// Merge multiple DTOs
@MergeDto([UserDto, AddressDto])
export class UserWithAddressDto {}
```

## Error Handling

Define structured error responses:

```typescript
import { Controller, Get, ReturnsError, t } from "adorn-api";

@Controller("/")
class ErrorController {
  @Get("/error")
  @ReturnsError({
    status: 404,
    schema: t.object({
      code: t.string(),
      message: t.string(),
      details: t.optional(t.record(t.any()))
    }),
    description: "Resource not found"
  })
  async notFound() {
    throw new HttpError(404, "Resource not found", { code: "NOT_FOUND" });
  }
}
```

## Lifecycle Hooks

```typescript
import {
  OnApplicationBootstrap,
  OnShutdown
} from "adorn-api";

class DatabaseService implements OnApplicationBootstrap, OnShutdown {
  async onApplicationBootstrap() {
    console.log("Connecting to database...");
    // Initialize database connection
  }

  async onShutdown(signal?: string) {
    console.log(`Shutting down (${signal})...`);
    // Cleanup resources
  }
}

// Register the service
import { lifecycleRegistry } from "adorn-api";
lifecycleRegistry.register(new DatabaseService());
```

## Examples

Check out the `examples/` directory for more comprehensive examples:

- `basic/` - Simple API with controllers and DTOs
- `restful/` - RESTful API with complete CRUD operations
- `metal-orm-sqlite/` - Metal ORM integration with SQLite
- `metal-orm-sqlite-music/` - Complex relations with Metal ORM
- `streaming/` - SSE and streaming responses
- `openapi/` - OpenAPI documentation customization

## Testing

Adorn API works great with testing frameworks like Vitest and SuperTest. Here's an example:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";

describe("User API", () => {
  it("should get user by id", async () => {
    const app = await createApp();
    
    const response = await request(app)
      .get("/users/1")
      .expect(200);
    
    expect(response.body).toEqual({
      id: "1",
      name: "Ada Lovelace",
      nickname: "Ada"
    });
  });
});
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
