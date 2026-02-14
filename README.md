# Adorn API

A modern, decorator-first web framework built on Express with built-in OpenAPI 3.1 schema generation, designed for rapid API development with excellent Type safety and developer experience.

## Features

- ✨ **Decorator-First API Definition**: Define controllers and DTOs with intuitive decorators
- 📚 **Automatic OpenAPI 3.1 Generation**: API documentation is generated from your code
- 🔌 **Express Integration**: Built on top of Express for familiarity and extensibility
- 🎯 **Type-Safe Data Transfer Objects**: Define schemas with TypeScript for compile-time checks
- 🔄 **DTO Composition**: Reuse and compose DTOs with PickDto, OmitDto, PartialDto, and MergeDto
- 📦 **Metal ORM Integration**: First-class support for Metal ORM with auto-generated CRUD DTOs, transformer-aware schema generation, and tree DTOs for nested set (MPTT) models
- 🚀 **Streaming Support**: Server-Sent Events (SSE) and streaming responses
- 🔧 **Raw Responses**: Return binary data, files, and non-JSON content with the `@Raw` decorator
- 📝 **Request Validation**: Automatic validation of request bodies, params, query, and headers
- 🔧 **Transformers**: Custom field transformations with @Transform decorator and built-in transform functions
-  **Error Handling**: Structured error responses with error DTO support
- 💾 **File Uploads**: Easy handling of file uploads with multipart form data
- 🌐 **CORS Support**: Built-in CORS configuration
- 🏗️ **Lifecycle Hooks**: Application bootstrap and shutdown lifecycle events

## Installation

```bash
npm install adorn-api
```

Note: Adorn uses Stage 3 decorator metadata (`Symbol.metadata`). If the runtime does not provide it, Adorn polyfills `Symbol.metadata` on import to keep decorator metadata consistent.

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

### Stage 3 Decorator Metadata

Adorn relies on Stage 3 decorator metadata (`Symbol.metadata`) to connect information across decorators (DTO fields, routes, params, etc.). If the runtime does not provide it, Adorn polyfills `Symbol.metadata` on import so decorators share a consistent metadata object.

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

### Raw Responses

Use the `@Raw()` decorator to return binary data (files, images, PDFs, etc.) without JSON serialization. The response body is sent with `res.send()` instead of `res.json()`.

```typescript
import { Controller, Get, Raw, Params, ok, type RequestContext } from "adorn-api";
import fs from "fs/promises";

@Controller("/files")
class FileController {
  @Get("/report.pdf")
  @Raw({ contentType: "application/pdf", description: "Download PDF report" })
  async downloadPdf(ctx: RequestContext) {
    const buffer = await fs.readFile("report.pdf");
    return ok(buffer);
  }

  @Get("/avatar/:id")
  @Raw({ contentType: "image/png" })
  async getAvatar(ctx: RequestContext) {
    const image = await fs.readFile(`avatars/${ctx.params.id}.png`);
    return image;
  }
}
```

You can also set custom headers (e.g. `Content-Disposition`) via `HttpResponse`:

```typescript
import { HttpResponse } from "adorn-api";

@Get("/download/:filename")
@Raw({ contentType: "application/octet-stream" })
async download(ctx: RequestContext) {
  const buffer = await fs.readFile(`uploads/${ctx.params.filename}`);
  return new HttpResponse(200, buffer, {
    "Content-Disposition": `attachment; filename="${ctx.params.filename}"`
  });
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
Transformer decorators such as `@Email`, `@Length`, `@Pattern`, and `@Alphanumeric` are reflected in the generated DTO schemas (validation + OpenAPI).

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
import { createMetalCrudDtoClasses, t } from "adorn-api";
import { User } from "./user.entity";

export const {
  response: UserDto,
  create: CreateUserDto,
  replace: ReplaceUserDto,
  update: UpdateUserDto,
  params: UserParamsDto,
  queryDto: UserQueryDto,
  optionsQueryDto: UserOptionsQueryDto,
  pagedResponseDto: UserPagedResponseDto,
  optionDto: UserOptionDto,
  optionsDto: UserOptionsDto,
  errors: UserErrors,
  filterMappings: USER_FILTER_MAPPINGS,
  sortableColumns: USER_SORTABLE_COLUMNS,
  listConfig: USER_LIST_CONFIG
} = createMetalCrudDtoClasses(User, {
  mutationExclude: ["id", "createdAt"],
  query: {
    filters: {
      nameContains: {
        schema: t.string({ minLength: 1 }),
        field: "name",
        operator: "contains"
      },
      emailContains: {
        schema: t.string({ minLength: 1 }),
        field: "email",
        operator: "contains"
      }
    },
    sortableColumns: {
      id: "id",
      name: "name",
      createdAt: "createdAt"
    },
    options: {
      labelField: "name"
    }
  },
  errors: true
});
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
  parseFilter,
  parsePagination,
  parseSort,
  t,
  type RequestContext
} from "adorn-api";
import { applyFilter, toPagedResponse } from "metal-orm";
import { createSession } from "./db";
import { User } from "./user.entity";
import {
  UserDto,
  CreateUserDto,
  ReplaceUserDto,
  UpdateUserDto,
  UserParamsDto,
  UserQueryDto,
  UserOptionsQueryDto,
  UserPagedResponseDto,
  UserOptionsDto,
  UserErrors,
  USER_FILTER_MAPPINGS,
  USER_SORTABLE_COLUMNS
} from "./user.dtos";

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    const query = (ctx.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const filters = parseFilter(query, USER_FILTER_MAPPINGS);
    const sort = parseSort(query, USER_SORTABLE_COLUMNS, {
      defaultSortBy: "id"
    });
    const direction = sort?.sortDirection === "desc" ? "DESC" : "ASC";
    const session = createSession();
    
    try {
      const ormQuery = applyFilter(
        User.select().orderBy(User.id, direction),
        User,
        filters
      );
      
      const paged = await ormQuery.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    } finally {
      await session.dispose();
    }
  }

  @Get("/options")
  @Query(UserOptionsQueryDto)
  @Returns(UserOptionsDto)
  async options(ctx: RequestContext<unknown, UserOptionsQueryDto>) {
    const query = (ctx.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const filters = parseFilter(query, USER_FILTER_MAPPINGS);
    // run your options query using the same mappings + generated DTOs
    return {
      items: [],
      totalItems: 0,
      page,
      pageSize,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    };
  }

  @Get("/:id")
  @Params({ id: t.integer() })
  @Returns(UserDto)
  @UserErrors
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

### Migration Guide (Breaking)

### CRUD Controller Factory (`createCrudController`)

When your controller only wires DTOs + service calls, you can generate the full CRUD controller and remove decorator boilerplate.

```typescript
// user.controller.ts
import { createCrudController } from "adorn-api";
import { userCrudDtos } from "./user.dtos";
import { UserCrudService } from "./user.service";

export const UserController = createCrudController({
  path: "/users",
  service: UserCrudService, // class or instance
  dtos: userCrudDtos,       // result of createMetalCrudDtoClasses(...)
  entityName: "User",       // used by parseIdOrThrow messages
  withOptionsRoute: true,
  withReplace: true,
  withPatch: true,
  withDelete: true
});
```

Generated routes:
- `GET /`
- `GET /options` (optional)
- `GET /:id`
- `POST /`
- `PUT /:id` (optional)
- `PATCH /:id` (optional)
- `DELETE /:id` (optional)

The factory applies the correct `@Query/@Body/@Params/@Returns` schemas and also propagates `dtos.errors` to all `/:id` routes.

Before (manual, repeated decorators/status/schema wiring):

```typescript
@Controller("/users")
class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) { ... }

  @Get("/:id")
  @Params(UserParamsDto)
  @Returns(UserDto)
  @UserErrors
  async getById(ctx: RequestContext<unknown, undefined, UserParamsDto>) { ... }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  async create(ctx: RequestContext<CreateUserDto>) { ... }

  // put/patch/delete/options...
}
```

After (factory + service):

```typescript
export const UserController = createCrudController({
  path: "/users",
  service: new UserCrudService(),
  dtos: userCrudDtos,
  entityName: "User"
});
```

When to use factory vs manual controller:
- Use `createCrudController` when routes follow standard CRUD and behavior lives in a service.
- Use a manual controller when route contracts diverge (custom status/body shape, non-standard params, upload/stream/raw endpoints, or route-level auth/doc decorators not shared by all CRUD routes).
- For extra endpoints, keep the generated CRUD controller and add a second manual controller for custom routes on the same base path.

Before (duplicated config):

```typescript
const UserQueryDto = createPagedFilterQueryDtoClass({
  filters: {
    nameContains: { schema: t.string(), operator: "contains" }
  }
});

const USER_FILTER_MAPPINGS = {
  nameContains: { field: "name", operator: "contains" as const }
};
```

After (single source of truth):

```typescript
const {
  queryDto: UserQueryDto,
  filterMappings: USER_FILTER_MAPPINGS
} = createMetalCrudDtoClasses(User, {
  query: {
    filters: {
      nameContains: {
        schema: t.string({ minLength: 1 }),
        field: "name",
        operator: "contains"
      }
    }
  }
});
```

Breaking changes summary:
- `createMetalCrudDtoClasses` now generates query/options/paged/error artifacts directly.
- Query filter definitions now include schema + operator + field mapping in one `query.filters` block.
- Sort allowlist now lives in `query.sortableColumns` and feeds both DTO schemas and runtime metadata.
- Generated outputs now include `queryDto`, `optionsQueryDto`, `pagedResponseDto`, `optionDto`, `optionsDto`, `errors`, `filterMappings`, and `sortableColumns`.
- Consumers no longer need internal `dist/...` imports for query/filter metadata types; all relevant types/utilities are publicly exported from `adorn-api`.

### Using `listConfig` (Zero-Duplication Service Layer)

`createMetalCrudDtoClasses` now exposes a `listConfig` object that bundles all filter/sort/pagination config needed by your service layer. No more re-declaring mappings in your repository:

```typescript
// user.controller.ts — using listConfig directly
import {
  Controller, Get, Query, Returns,
  parseFilter, parsePagination, parseSort,
  type RequestContext
} from "adorn-api";
import { applyFilter, toPagedResponse } from "metal-orm";
import { createSession } from "./db";
import { User } from "./user.entity";
import {
  UserQueryDto,
  UserPagedResponseDto,
  USER_LIST_CONFIG
} from "./user.dtos";

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    const query = (ctx.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query, USER_LIST_CONFIG);
    const filters = parseFilter(query, USER_LIST_CONFIG.filterMappings);
    const sort = parseSort(query, USER_LIST_CONFIG.sortableColumns, {
      defaultSortBy: USER_LIST_CONFIG.defaultSortBy,
      defaultSortDirection: USER_LIST_CONFIG.defaultSortDirection
    });
    const direction = sort?.sortDirection === "desc" ? "DESC" : "ASC";

    const session = createSession();
    try {
      const ormQuery = applyFilter(
        User.select().orderBy(User.id, direction),
        User,
        filters
      );
      const paged = await ormQuery.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    } finally {
      await session.dispose();
    }
  }
}
```

The `listConfig` object contains: `filterMappings`, `sortableColumns`, `defaultSortBy`, `defaultSortDirection`, `defaultPageSize`, `maxPageSize`, `sortByKey`, and `sortDirectionKey`.

### Sort Order Compatibility (`sortOrder` / `sortDirection`)

`parseSort` now accepts both `sortDirection` (lowercase `asc`/`desc`) and `sortOrder` (uppercase `ASC`/`DESC`). This avoids the need for a custom helper when integrating with clients that send uppercase sort orders.

**Precedence**: `sortDirection` > `sortOrder` > default. Direction values are case-insensitive.

```typescript
// Client sends: ?sortBy=name&sortOrder=DESC
const sort = parseSort(query, sortableColumns);
// → { sortBy: "name", sortDirection: "desc", field: "name" }

// Client sends both: ?sortBy=name&sortDirection=asc&sortOrder=DESC
const sort2 = parseSort(query, sortableColumns);
// → { sortBy: "name", sortDirection: "asc", field: "name" }  (sortDirection wins)

// Custom sortOrder key:
const sort3 = parseSort({
  query,
  sortableColumns,
  sortOrderKey: "order"  // reads from query.order instead of query.sortOrder
});
```

### Deep Relation Filters

`parseFilter` now accepts nested relation paths, so you can filter deep chains like Alpha → Bravo → Charlie → Delta. If
you type your filter mappings with `FilterMapping`, VS Code will enforce relation quantifiers like `some`, `every`, or
`none` for relation filters, matching Metal ORM's runtime rules.

```typescript
// alpha.entity.ts
import { BelongsTo, Column, Entity, HasMany, PrimaryKey, col } from "metal-orm";
import type { BelongsToReference, HasManyCollection } from "metal-orm";

@Entity({ tableName: "alphas" })
export class Alpha {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @HasMany({ target: () => Bravo, foreignKey: "alphaId" })
  bravos!: HasManyCollection<Bravo>;
}

@Entity({ tableName: "bravos" })
export class Bravo {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  code!: string;

  @Column(col.notNull(col.int()))
  alphaId!: number;

  @BelongsTo({ target: () => Alpha, foreignKey: "alphaId" })
  alpha!: BelongsToReference<Alpha>;

  @HasMany({ target: () => Charlie, foreignKey: "bravoId" })
  charlies!: HasManyCollection<Charlie>;
}

@Entity({ tableName: "charlies" })
export class Charlie {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  score!: number;

  @Column(col.notNull(col.int()))
  bravoId!: number;

  @Column(col.int())
  deltaId?: number | null;

  @BelongsTo({ target: () => Bravo, foreignKey: "bravoId" })
  bravo!: BelongsToReference<Bravo>;

  @BelongsTo({ target: () => Delta, foreignKey: "deltaId" })
  delta?: BelongsToReference<Delta>;
}

@Entity({ tableName: "deltas" })
export class Delta {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;
}
```

```typescript
// alpha.controller.ts (filtering)
import { parseFilter, type FilterMapping } from "adorn-api";
import { applyFilter, selectFromEntity, type WhereInput } from "metal-orm";
import { Alpha } from "./alpha.entity";

const ALPHA_FILTERS = {
  deltaNameContains: {
    field: "bravos.some.charlies.some.delta.some.name",
    operator: "contains"
  },
  deltaIsMissing: {
    field: "bravos.some.charlies.some.delta",
    operator: "isEmpty"
  },
  charlieScoreGte: {
    field: "bravos.some.charlies.some.score",
    operator: "gte"
  }
} as const satisfies Record<string, FilterMapping<Alpha>>;

const filters = parseFilter(
  (ctx.query ?? {}) as Record<string, unknown>,
  ALPHA_FILTERS
);

const query = applyFilter(
  selectFromEntity(Alpha),
  Alpha,
  filters as WhereInput<typeof Alpha>
);
```

Example query string: `?deltaNameContains=core&charlieScoreGte=90`

### Tree DTOs (Nested Set / MPTT)

Metal ORM's tree helpers map cleanly into Adorn. Use `createMetalTreeDtoClasses` to generate DTOs for tree nodes,
node results, threaded trees, and tree lists. These schemas are included in OpenAPI automatically.

```typescript
// category.dtos.ts
import { createMetalTreeDtoClasses } from "adorn-api";
import { CategoryDto } from "./category.dtos";
import { Category } from "./category.entity";

export const {
  node: CategoryNodeDto,
  nodeResult: CategoryNodeResultDto,
  threadedNode: CategoryThreadedNodeDto,
  treeListEntry: CategoryTreeListEntryDto,
  treeListSchema: CategoryTreeListSchema,
  threadedTreeSchema: CategoryThreadedTreeSchema
} = createMetalTreeDtoClasses(Category, {
  entityDto: CategoryDto
});
```

```typescript
// category.controller.ts
import { Controller, Get, Returns } from "adorn-api";
import { CategoryThreadedTreeSchema } from "./category.dtos";

@Controller("/categories")
class CategoryController {
  @Get("/tree")
  @Returns(CategoryThreadedTreeSchema)
  async tree() {
    // return threaded tree data
  }
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
  validation: { // Validation configuration
    enabled: true, // Enable validation (default: true)
    mode: "strict" // Validation mode: "strict" or "safe"
  },
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

## Validation

Adorn API provides automatic request validation and a comprehensive validation system for your DTOs and schemas.

### Validation Configuration

```typescript
createExpressApp({
  controllers: [UserController],
  validation: {
    enabled: true, // Enable validation (default: true)
    mode: "strict" // Validation mode: "strict" or "safe"
  }
});
```

### Validation Errors

Invalid requests automatically return structured validation errors:

```typescript
// Example error response
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "must be at least 1 character long",
      "value": "",
      "code": "STRING_MIN_LENGTH"
    },
    {
      "field": "email",
      "message": "must be a valid email",
      "value": "invalid-email",
      "code": "FORMAT_EMAIL"
    }
  ]
}
```

### Validation Error Codes

Adorn API provides machine-readable error codes for programmatic error handling:

```typescript
import { ValidationErrorCode } from "adorn-api";

console.log(ValidationErrorCode.FORMAT_EMAIL); // "FORMAT_EMAIL"
console.log(ValidationErrorCode.STRING_MIN_LENGTH); // "STRING_MIN_LENGTH"
```

### Manual Validation

You can also manually validate data using the `validate` function:

```typescript
import { validate, ValidationErrors, t } from "adorn-api";

const data = { name: "", email: "invalid" };
const errors = validate(data, t.object({
  name: t.string({ minLength: 1 }),
  email: t.string({ format: "email" })
}));

if (errors.length > 0) {
  throw new ValidationErrors(errors);
}
```

## Transformers

Transform fields during serialization with custom transform functions or built-in transform utilities.

### Basic Transform

```typescript
import { Dto, Field, Transform, t } from "adorn-api";

@Dto()
export class UserDto {
  @Field(t.string())
  @Transform((value) => value.toUpperCase())
  name!: string;

  @Field(t.dateTime())
  @Transform((value) => value.toISOString())
  createdAt!: Date;
}
```

### Built-in Transforms

Adorn API includes common transform functions:

```typescript
import { Dto, Field, Transform, Transforms, t } from "adorn-api";

@Dto()
export class UserDto {
  @Field(t.string())
  @Transform(Transforms.toLowerCase)
  email!: string;

  @Field(t.number())
  @Transform(Transforms.round(2))
  price!: number;

  @Field(t.string())
  @Transform(Transforms.mask(4)) // Mask all but last 4 characters
  creditCard!: string;

  @Field(t.dateTime())
  @Transform(Transforms.toISOString)
  birthDate!: Date;
}
```

### Conditional Transforms with Groups

Apply transforms only to specific serialization groups:

```typescript
import { Dto, Field, Transform, Expose, t } from "adorn-api";

@Dto()
export class UserDto {
  @Field(t.string())
  name!: string;

  @Field(t.string())
  @Expose({ groups: ["admin"] })
  @Transform((value) => Transforms.mask(2), { groups: ["admin"] })
  phoneNumber!: string;

  @Field(t.string())
  @Expose({ groups: ["internal"] })
  @Transform((value) => "[REDACTED]", { groups: ["external"] })
  internalNote!: string;
}
```

### Custom Transform Functions

Create custom transform functions:

```typescript
import { Dto, Field, Transform, t } from "adorn-api";

const toCurrency = (value: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(value);
};

@Dto()
export class ProductDto {
  @Field(t.string())
  name!: string;

  @Field(t.number())
  @Transform(toCurrency)
  price!: number;

  @Field(t.number())
  @Transform((value) => toCurrency(value, "EUR"))
  priceEUR!: number;
}
```

### Serialization with Options

Control serialization with custom options:

```typescript
import { serialize, createSerializer } from "adorn-api";
import { UserDto } from "./user.dtos";

const user = new UserDto();
user.name = "John Doe";
user.phoneNumber = "123-456-7890";
user.internalNote = "This is an internal note";

// Basic serialization
const basic = serialize(user);
// Output: { name: "John Doe" }

// Admin group serialization
const admin = serialize(user, { groups: ["admin"] });
// Output: { name: "John Doe", phoneNumber: "********90" }

// External group serialization
const external = serialize(user, { groups: ["external"] });
// Output: { name: "John Doe", internalNote: "[REDACTED]" }

// Create a preset serializer
const adminSerializer = createSerializer({ groups: ["admin"] });
const adminData = adminSerializer(user);
```

### Exclude Fields

Control which fields are excluded or exposed:

```typescript
import { Dto, Field, Exclude, Expose, t } from "adorn-api";

@Dto()
export class UserDto {
  @Field(t.string())
  name!: string;

  @Field(t.string())
  @Exclude() // Always exclude from serialization
  password!: string;

  @Field(t.string())
  @Expose({ name: "email_address" }) // Rename field in output
  email!: string;

  @Field(t.string())
  @Exclude({ groups: ["public"] }) // Exclude from public group
  internalComment!: string;
}
```

## Examples

Check out the `examples/` directory for more comprehensive examples:

- `basic/` - Simple API with controllers and DTOs
- `restful/` - RESTful API with complete CRUD operations
- `metal-orm-sqlite/` - Metal ORM integration with SQLite
- `metal-orm-tree/` - Metal ORM tree (nested set) DTO + OpenAPI integration
- `metal-orm-deep-filters/` - Deep relation filtering example (Alpha → Bravo → Charlie → Delta)
- `metal-orm-sqlite-music/` - Complex relations with Metal ORM
- `streaming/` - SSE and streaming responses
- `openapi/` - OpenAPI documentation customization
- `validation/` - Comprehensive validation examples with various schema types

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
