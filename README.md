# Adorn API

Decorator-first API framework for TypeScript with Express, Fastify, native Node HTTP, OpenAPI 3.2 generation, request validation, Bearer auth, file uploads, streaming, and optional Metal ORM helpers.

Adorn is designed for APIs where the route contract should live beside the handler: controllers, DTOs, schemas, validation, serialization, and OpenAPI are all derived from the same decorators.

## Features

- Controller and route decorators: `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@Trace`, `@QueryMethod`, `@Http`
- DTO decorators: `@Dto`, `@Field`, `@PickDto`, `@OmitDto`, `@PartialDto`, `@MergeDto`
- Schema builder: `t.string`, `t.uuid`, `t.integer`, `t.object`, `t.array`, `t.file`, and more
- OpenAPI 3.2 JSON and Swagger UI
- Express, Fastify, and native Node HTTP adapters
- Built-in Bearer token auth for `@Auth`, `@Roles`, `@AllRoles`, and `@Public`
- Runtime validation for body, query, params, and headers
- Input coercion for params/query/body
- Multipart file uploads
- Raw responses, SSE, and streaming responses
- Response serialization with `@Expose`, `@Exclude`, and `@Transform`
- Health checks, request logging, and lifecycle hooks
- Metal ORM DTO, CRUD, pagination, filtering, sorting, and tree helpers

## Installation

```bash
npm install adorn-api
```

Adorn uses Stage 3 decorators and `Symbol.metadata`. The package polyfills `Symbol.metadata` on import when the runtime does not provide it.

Recommended TypeScript settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "moduleResolution": "Node",
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,
    "useDefineForClassFields": true,
    "strict": true
  }
}
```

## Quick Start

### DTOs

```typescript
import { Dto, Field, OmitDto, PickDto, t } from "adorn-api";

@Dto({ description: "User returned by the API." })
export class UserDto {
  @Field(t.uuid({ description: "User identifier." }))
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.string()))
  nickname?: string;
}

export interface CreateUserDto extends Omit<UserDto, "id"> {}

@OmitDto(UserDto, ["id"])
export class CreateUserDto {}

export interface UserParamsDto extends Pick<UserDto, "id"> {}

@PickDto(UserDto, ["id"])
export class UserParamsDto {}
```

### Controller

```typescript
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

### App

```typescript
import { createExpressApp } from "adorn-api";
import { UserController } from "./user.controller";

async function start() {
  const app = await createExpressApp({
    controllers: [UserController],
    openApi: {
      info: {
        title: "Users API",
        version: "1.0.0"
      },
      docs: true
    }
  });

  app.listen(3000, () => {
    console.log("API: http://localhost:3000");
    console.log("Docs: http://localhost:3000/docs");
    console.log("OpenAPI: http://localhost:3000/openapi.json");
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Run the bundled basic example:

```bash
npm run example -- basic
```

## Adapters

### Express

```typescript
import { createExpressApp } from "adorn-api";

const app = await createExpressApp({
  controllers: [UserController],
  cors: {
    origin: "https://app.example.com",
    credentials: true
  },
  jsonBody: true,
  jsonLimit: "1mb",
  inputCoercion: "safe",
  validation: { enabled: true, mode: "strict" },
  multipart: {
    storage: "memory",
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 10
  },
  openApi: {
    info: { title: "API", version: "1.0.0" },
    path: "/openapi.json",
    docs: { path: "/docs" }
  }
});
```

### Fastify

```typescript
import { createFastifyApp } from "adorn-api";

const app = await createFastifyApp({
  controllers: [UserController],
  bodyLimit: 1_048_576,
  cors: true,
  inputCoercion: "safe",
  multipart: true,
  openApi: {
    info: { title: "API", version: "1.0.0" },
    docs: true
  }
});

await app.listen({ port: 3000 });
```

### Native Node HTTP

```typescript
import { createNativeApp } from "adorn-api";

const app = await createNativeApp({
  controllers: [UserController],
  bodyLimit: 1_048_576,
  openApi: {
    info: { title: "API", version: "1.0.0" },
    docs: true
  }
});

app.listen(3000, () => {
  console.log("Native API running on http://localhost:3000");
});
```

## Request Context

Every handler receives a `RequestContext`:

```typescript
interface RequestContext<TBody, TQuery, TParams, THeaders, TFiles, TQueryString> {
  req: any;
  res: any;
  body: TBody;
  query: TQuery;
  querystring: TQueryString;
  params: TParams;
  headers: THeaders;
  files: TFiles;
  sse?: SseEmitterInterface;
  stream?: StreamWriterInterface;
}
```

Use adapter-specific aliases when useful:

```typescript
import type {
  ExpressRequestContext,
  FastifyRequestContext,
  NativeRequestContext
} from "adorn-api";
```

## Controllers and Decorators

### Route Definition

```typescript
@Controller({ path: "/tasks", tags: ["Tasks"] })
class TaskController {
  @Get("/:id")
  @Doc({ summary: "Get a task" })
  @Params(t.object({ id: t.uuid() }))
  @Query(t.object({ includeHistory: t.optional(t.boolean()) }))
  @Headers(t.object({ "x-request-id": t.optional(t.string()) }))
  @Returns(TaskDto)
  async getTask(ctx: RequestContext) {
    return findTask(ctx.params.id);
  }
}
```

Available route decorators:

- HTTP methods: `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@Trace`, `@QueryMethod`, `@Http`
- Inputs: `@Body`, `@Query`, `@QueryString`, `@Params`, `@Headers`
- Outputs: `@Returns`, `@ReturnsError`, `@Errors`
- Docs: `@Doc`, controller `tags`
- Auth: `@Auth`, `@Roles`, `@AllRoles`, `@Public`
- Files and streams: `@UploadedFile`, `@UploadedFiles`, `@Raw`, `@Sse`, `@Streaming`

OpenAPI 3.2 additional methods and whole-query-string parameters are first-class:

```typescript
@Controller("/search")
class SearchController {
  @QueryMethod("/")
  @QueryString(t.object({ q: t.string(), page: t.optional(t.integer()) }))
  async query(ctx: RequestContext<unknown, unknown, unknown, unknown, unknown, { q: string; page?: number }>) {
    return ctx.querystring;
  }

  @Http("LINK", "/relations")
  async link() {
    return { ok: true };
  }
}
```

### HTTP Responses

Return a plain value for the default status, or return `HttpResponse` helpers when status/headers matter:

```typescript
import { created, noContent, ok, redirect } from "adorn-api";

@Post("/")
@Returns({ status: 201, schema: TaskDto })
async create(ctx: RequestContext<CreateTaskDto>) {
  return created(await createTask(ctx.body));
}

@Delete("/:id")
@Returns({ status: 204 })
async remove() {
  return noContent();
}

@Get("/legacy")
async legacy() {
  return redirect("/tasks", 301);
}
```

Throw structured HTTP errors:

```typescript
import { badRequest, forbidden, notFound, unauthorized } from "adorn-api";

if (!task) {
  notFound("Task not found");
}
```

Available helpers: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessableEntity`, `tooManyRequests`, `serviceUnavailable`, and `internalServerError`.

## Schemas and DTOs

### Schema Builder

The `t` builder creates runtime validation and OpenAPI schemas:

```typescript
const TaskSchema = t.object({
  id: t.uuid(),
  title: t.string({ minLength: 1, maxLength: 120 }),
  status: t.enum(["todo", "doing", "done"]),
  priority: t.integer({ minimum: 1, maximum: 5 }),
  tags: t.array(t.string(), { uniqueItems: true }),
  metadata: t.record(t.any()),
  dueAt: t.nullable(t.dateTime()),
  attachment: t.optional(t.file({ accept: ["application/pdf"] }))
});
```

Available schema helpers:

- Primitives: `t.string`, `t.number`, `t.integer`, `t.boolean`
- Formats: `t.uuid`, `t.dateTime`, `t.bytes`
- Containers: `t.object`, `t.array`, `t.record`
- Composition: `t.enum`, `t.literal`, `t.union`, `t.ref`
- Utility: `t.any`, `t.null`, `t.file`, `t.optional`, `t.nullable`

Common options include `description`, `title`, `default`, `examples`, `deprecated`, `readOnly`, `writeOnly`, `optional`, and `nullable`.

### DTO Composition

```typescript
@Dto()
class UserDto {
  @Field(t.uuid())
  id!: string;

  @Field(t.string())
  name!: string;

  @Field(t.string())
  passwordHash!: string;
}

@PickDto(UserDto, ["id", "name"])
class PublicUserDto {}

@OmitDto(UserDto, ["id", "passwordHash"])
class CreateUserDto {}

@PartialDto(CreateUserDto)
class UpdateUserDto {}

@MergeDto([PublicUserDto, ProfileDto])
class UserProfileDto {}
```

Composition decorators can override schema, optionality, descriptions, name, and `additionalProperties`.

## Authentication

Decorate controllers or routes with `@Auth`. `@Roles` and `@AllRoles` imply authentication. `@Public` overrides controller-level auth for one route.

```typescript
import {
  Auth,
  Controller,
  Get,
  Public,
  Roles,
  createExpressApp,
  getUser,
  type AuthUser,
  type RequestContext
} from "adorn-api";

@Auth()
@Controller("/account")
class AccountController {
  @Get("/health")
  @Public()
  health() {
    return { ok: true };
  }

  @Get("/me")
  me(ctx: RequestContext) {
    return getUser<AuthUser>(ctx.req);
  }

  @Get("/admin")
  @Roles("admin")
  adminOnly() {
    return { ok: true };
  }
}

const app = await createExpressApp({
  controllers: [AccountController],
  bearerAuth: {
    async verifyToken(token, req) {
      if (token === "admin-token") {
        return { id: "admin-1", roles: ["admin"] };
      }
      if (token === "user-token") {
        return { id: "user-1", roles: ["user"] };
      }
      return null;
    }
  }
});
```

Bearer auth reads only:

```text
Authorization: Bearer <token>
```

`verifyToken` is intentionally application-owned. Use it to verify JWTs, opaque tokens, API keys, or session tokens. Returning `null` means the request is unauthenticated.

Protected routes are emitted in OpenAPI with:

```json
{
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}
```

CORS is not enabled automatically. Server-to-server clients do not need CORS. Browser clients still need explicit `cors` configuration.

Try the Swagger auth example:

```bash
npm run example -- bearer-auth-swagger
```

Then open `http://localhost:3001/docs` and use `user-token` or `admin-token` in Swagger Authorize.

## OpenAPI and Swagger UI

Adapters can serve OpenAPI JSON and Swagger UI:

```typescript
await createExpressApp({
  controllers: [UserController],
  openApi: {
    info: {
      title: "Users API",
      version: "1.0.0",
      description: "Public API contract"
    },
    servers: [{ url: "https://api.example.com", description: "Production" }],
    path: "/openapi.json",
    prettyPrint: true,
    docs: {
      path: "/docs",
      title: "Users API Docs"
    }
  }
});
```

OpenAPI 3.2 metadata can be set on the generated document:

```typescript
await createExpressApp({
  controllers: [UserController],
  openApi: {
    info: { title: "Users API", version: "1.0.0" },
    $self: "https://api.example.com/openapi.json",
    servers: [{ name: "prod", url: "https://api.example.com" }],
    tags: [{ name: "Users", summary: "User operations", kind: "nav" }],
    components: {
      mediaTypes: {
        JsonLine: { schema: { type: "object" } }
      }
    }
  }
});
```

You can also build the document without starting an HTTP server:

```typescript
import { buildOpenApi } from "adorn-api";

const document = buildOpenApi({
  info: { title: "Users API", version: "1.0.0" },
  controllers: [UserController]
});
```

OpenAPI generation includes:

- DTO schemas under `components.schemas`
- query, path, header, body, multipart, and response schemas
- route summaries/descriptions/tags from `@Doc`
- Bearer security schemes for protected routes
- raw, SSE, and streaming content types
- OpenAPI 3.2 `$self`, tag metadata, `query` operations, `additionalOperations`, `querystring` parameters, response summaries, `itemSchema`, and reusable `components.mediaTypes`

## Validation and Coercion

Validation runs for `@Body`, `@Query`, `@Params`, and `@Headers` unless disabled:

```typescript
await createExpressApp({
  controllers: [UserController],
  validation: { enabled: true, mode: "strict" },
  inputCoercion: "safe"
});
```

Invalid input returns a structured 400 response with field-level errors.

Manual validation is also available:

```typescript
import { ValidationErrors, t, validate } from "adorn-api";

const schema = t.object({
  email: t.string({ format: "email" }),
  age: t.integer({ minimum: 18 })
});

const errors = validate(data, schema);
if (errors.length) {
  throw new ValidationErrors(errors);
}
```

Input coercion can be:

- `"safe"`: coerce common values such as `"1"` to `1` and `"true"` to `true`
- `"strict"`: stricter conversion rules
- `false`: disabled

Low-level coercion helpers are exported as `coerce`, `parseNumber`, `parseInteger`, `parseBoolean`, and `parseId`.

## Serialization

Response serialization respects DTO schemas and transformation decorators:

```typescript
import { Dto, Exclude, Expose, Field, Transform, Transforms, serialize, t } from "adorn-api";

@Dto()
class UserDto {
  @Field(t.string())
  id!: string;

  @Field(t.string())
  @Transform(Transforms.toLowerCase)
  email!: string;

  @Field(t.string())
  @Exclude()
  passwordHash!: string;

  @Field(t.string())
  @Expose({ name: "display_name" })
  name!: string;
}

const output = serialize(user);
```

Use `createSerializer({ groups: [...] })` when you need reusable serialization presets.

## File Uploads

Enable multipart on the adapter and declare file fields on the route:

```typescript
import { Controller, Post, Returns, UploadedFile, UploadedFiles, t } from "adorn-api";

@Controller("/uploads")
class UploadController {
  @Post("/avatar")
  @UploadedFile("file", t.file({ accept: ["image/*"], maxSize: 5 * 1024 * 1024 }))
  @Returns(t.object({ originalName: t.string(), size: t.integer() }))
  async avatar(ctx: any) {
    const file = ctx.files.file;
    return {
      originalName: file.originalName,
      size: file.size
    };
  }

  @Post("/gallery")
  @UploadedFiles("files", t.file({ accept: ["image/*"] }))
  async gallery(ctx: any) {
    return { count: ctx.files.files.length };
  }
}

await createExpressApp({
  controllers: [UploadController],
  multipart: {
    storage: "memory",
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 10
  }
});
```

Uploaded file info contains `originalName`, `mimeType`, `size`, `buffer`, `path`, and `fieldName`.

## Raw, SSE, and Streaming

### Raw Responses

```typescript
import { Controller, Get, Raw, ok } from "adorn-api";
import fs from "node:fs/promises";

@Controller("/files")
class FileController {
  @Get("/report.pdf")
  @Raw({ contentType: "application/pdf", description: "Download PDF report" })
  async report() {
    return ok(await fs.readFile("report.pdf"));
  }
}
```

### Server-Sent Events

```typescript
import { Controller, Get, Sse } from "adorn-api";

@Controller("/events")
class EventsController {
  @Get("/")
  @Sse({ description: "Event stream" })
  async stream(ctx: any) {
    ctx.sse.send({ message: "connected" });
    ctx.sse.close();
  }
}
```

### Streaming

```typescript
import { Controller, Get, Streaming, t } from "adorn-api";

@Controller("/exports")
class ExportController {
  @Get("/ndjson")
  @Streaming({
    contentType: "application/x-ndjson",
    itemSchema: t.object({ id: t.integer() })
  })
  async ndjson(ctx: any) {
    ctx.stream.writeJsonLine({ id: 1 });
    ctx.stream.writeJsonLine({ id: 2 });
    ctx.stream.close();
  }
}
```

## Health, Logging, and Lifecycle

### Health Checks

```typescript
import {
  createHealthController,
  databaseIndicator,
  memoryIndicator
} from "adorn-api";

const HealthController = createHealthController({
  path: "/health",
  indicators: [
    memoryIndicator({ degradedMB: 512, unhealthyMB: 1024 }),
    databaseIndicator("database", async () => {
      await db.ping();
    })
  ]
});
```

### Logging

```typescript
import { createLogger, prettyTransport, requestLogger } from "adorn-api";

const logger = createLogger({
  level: "info",
  transport: prettyTransport
});

logger.info("Application booted");

app.use(requestLogger({
  transport: prettyTransport,
  skip: ["/health/live"]
}));
```

### Lifecycle Hooks

```typescript
import {
  lifecycleRegistry,
  type OnApplicationBootstrap,
  type OnApplicationShutdown
} from "adorn-api";

class DatabaseService implements OnApplicationBootstrap, OnApplicationShutdown {
  async onApplicationBootstrap() {
    await db.connect();
  }

  async onApplicationShutdown() {
    await db.close();
  }
}

lifecycleRegistry.register(new DatabaseService());
```

Use `shutdownExpressApp`, `shutdownFastifyApp`, or `shutdownNativeApp` to trigger shutdown hooks and clear the lifecycle registry.

## Metal ORM

Adorn includes optional helpers for Metal ORM projects. They generate DTOs, OpenAPI schemas, filters, pagination, sorting, and CRUD controllers from entity metadata.

### Entity DTOs

```typescript
import { createMetalCrudDtoClasses, t } from "adorn-api";
import { User } from "./user.entity";

export const userCrudDtos = createMetalCrudDtoClasses(User, {
  mutationExclude: ["id", "createdAt"],
  query: {
    filters: {
      nameContains: {
        schema: t.string({ minLength: 1 }),
        field: "name",
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
} = userCrudDtos;
```

### Paged Lists

```typescript
import { Controller, Get, Query, Returns, runPagedList, type RequestContext } from "adorn-api";
import { createSession } from "./db";
import { User } from "./user.entity";
import { UserPagedResponseDto, UserQueryDto, USER_LIST_CONFIG } from "./user.dtos";

@Controller("/users")
class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    const session = createSession();
    try {
      return await runPagedList({
        query: (ctx.query ?? {}) as Record<string, unknown>,
        target: User,
        qb: () => User.select(),
        session,
        ...USER_LIST_CONFIG
      });
    } finally {
      await session.dispose();
    }
  }
}
```

### CRUD Controller Factory

```typescript
import { createCrudController } from "adorn-api";
import { userCrudDtos } from "./user.dtos";
import { UserCrudService } from "./user.service";

export const UserController = createCrudController({
  path: "/users",
  service: new UserCrudService(),
  dtos: userCrudDtos,
  entityName: "User",
  withOptionsRoute: true,
  withReplace: true,
  withPatch: true,
  withDelete: true
});
```

Generated routes:

- `GET /`
- `GET /options` when `withOptionsRoute` is true
- `GET /:id`
- `POST /`
- `PUT /:id` when `withReplace` is true
- `PATCH /:id` when `withPatch` is true
- `DELETE /:id` when `withDelete` is true

### Filters and Sort

Use generated `filterMappings`, `sortableColumns`, and `listConfig` where possible. Manual parsers are also public:

```typescript
import { parseFilter, parsePagination, parseSort } from "adorn-api";

const pagination = parsePagination(ctx.query);
const filters = parseFilter(ctx.query, USER_FILTER_MAPPINGS);
const sort = parseSort(ctx.query, USER_SORTABLE_COLUMNS);
```

`parseSort` accepts `sortDirection=asc|desc` and legacy `sortOrder=ASC|DESC`. `sortDirection` wins when both are present.

Deep relation filters are supported through typed Metal ORM field paths such as:

```typescript
const filters = {
  deltaNameContains: {
    field: "bravos.some.charlies.some.delta.some.name",
    operator: "contains"
  }
} as const;
```

### Tree DTOs

```typescript
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

## Examples

Run examples with:

```bash
npm run example -- <name>
```

Available examples:

- `basic`: Express API with DTOs and OpenAPI
- `bearer-auth-swagger`: Bearer token auth in Swagger UI
- `fastify`: Fastify adapter
- `openapi`: build and print an OpenAPI document
- `restful`: in-memory REST CRUD
- `streaming`: SSE and streaming routes
- `validation`: schema validation examples
- `metal-orm`: baseline Metal ORM example
- `metal-orm-collection-lawsuit`: collection/relation scenario with Metal ORM
- `metal-orm-sqlite`: Metal ORM with SQLite
- `metal-orm-postgres`: Metal ORM with Postgres
- `metal-orm-sqlite-music`: richer Metal ORM relations
- `metal-orm-deep-filters`: nested relation filters
- `metal-orm-tree`: tree DTO generation

## Testing

The project uses Vitest and SuperTest.

```bash
npm run build
npm test
npm run typecheck:tests
```

Example app test:

```typescript
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app";

describe("Users API", () => {
  it("gets a user", async () => {
    const app = await createApp();

    const response = await request(app)
      .get("/users/3f0f4d0f-1cb1-4cf1-9c32-3d4bce1b3f36")
      .expect(200);

    expect(response.body.name).toBe("Ada Lovelace");
  });
});
```

## Public Entry Points

The package exports:

- Core decorators, schemas, OpenAPI, errors, responses, validation, coercion, serialization, auth, lifecycle, streaming, health, and logger helpers
- Express adapter: `createExpressApp`, `attachExpressControllers`, `attachExpressOpenApi`, `shutdownExpressApp`
- Fastify adapter: `createFastifyApp`, `attachFastifyControllers`, `attachFastifyOpenApi`, `shutdownFastifyApp`
- Native adapter: `createNativeApp`, `attachNativeControllers`, `attachNativeOpenApi`, `shutdownNativeApp`
- Metal ORM helpers from `adorn-api`

## License

MIT
