# Adorn API

[![npm version](https://badge.fury.io/js/adorn-api.svg)](https://www.npmjs.com/package/adorn-api)

Decorator-first web framework for TypeScript with OpenAPI 3.1 schema generation.

## Features

- **Decorator-based API definition** - Use TypeScript decorators to define controllers, routes, DTOs, and schemas
- **OpenAPI 3.1 generation** - Automatically generate OpenAPI 3.1 specifications from your decorators
- **Express integration** - Built-in Express adapter with automatic request/response handling
- **Metal ORM integration** - Seamlessly integrate with Metal ORM for database operations
- **Type-safe DTOs** - Create type-safe Data Transfer Objects with composition utilities
- **Input coercion** - Automatic type coercion for query parameters and path parameters (safe or strict modes)
- **Error handling** - Built-in HTTP error handling with customizable error DTOs
- **Swagger UI** - Built-in Swagger UI documentation

## Installation

```bash
npm install adorn-api express metal-orm
```

## Quick Start

```typescript
import { Controller, Get, Dto, Field, t, createExpressApp } from "adorn-api";

@Dto({ description: "User record" })
class UserDto {
  @Field(t.uuid({ description: "User ID" }))
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;
}

@Controller("/users")
class UserController {
  @Get("/:id")
  @Params(UserDto)
  @Returns(UserDto)
  async getOne(ctx: RequestContext<unknown, undefined, UserDto>) {
    return {
      id: ctx.params.id,
      name: "Ada Lovelace"
    };
  }
}

const app = createExpressApp({
  controllers: [UserController],
  openApi: {
    info: { title: "My API", version: "1.0.0" },
    docs: true
  }
});

app.listen(3000);
```

Visit http://localhost:3000/docs to see your API documentation.

## Examples

The repository includes several examples demonstrating different features:

- **basic** - Simple controller and DTO usage
- **restful** - RESTful API with full CRUD operations
- **openapi** - OpenAPI documentation setup
- **metal-orm-sqlite** - Metal ORM integration with SQLite
- **metal-orm-sqlite-music** - Complex Metal ORM example with relationships

Run an example:
```bash
npm run example basic
```

## Core Concepts

### DTOs (Data Transfer Objects)

DTOs define the shape of your API data:

```typescript
@Dto({ description: "User data" })
class UserDto {
  @Field(t.uuid())
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.string()))
  nickname?: string;
}
```

### Controllers

Controllers group related routes:

```typescript
@Controller("/users")
class UserController {
  @Get("/")
  async list() {
    return [{ id: "1", name: "User 1" }];
  }

  @Post("/")
  @Body(CreateUserDto)
  async create(ctx: RequestContext<CreateUserDto>) {
    return { id: "new-id", ...ctx.body };
  }
}
```

### Request Context

Route handlers receive a typed `RequestContext` with:
- `req` - Express request
- `res` - Express response
- `body` - Parsed request body
- `query` - Parsed query parameters
- `params` - Parsed path parameters
- `headers` - Request headers

## Decorators

### Controller Decorators

- `@Controller(pathOrOptions)` - Define a controller with base path and tags

### HTTP Method Decorators

- `@Get(path)` - GET route
- `@Post(path)` - POST route
- `@Put(path)` - PUT route
- `@Patch(path)` - PATCH route
- `@Delete(path)` - DELETE route

### Input Decorators

- `@Body(schema, options)` - Request body schema
- `@Query(schema, options)` - Query parameters schema
- `@Params(schema, options)` - Path parameters schema
- `@Headers(schema, options)` - Request headers schema

### Response Decorators

- `@Returns(schemaOrOptions, options)` - Define response schema
- `@ReturnsError(schemaOrOptions, options)` - Define error response
- `@Errors(schema, responses)` - Define multiple error responses
- `@Doc(options)` - Add route documentation

### DTO Decorators

- `@Dto(options)` - Define a DTO class
- `@Field(schemaOrOptions)` - Define a field in a DTO

### DTO Composition

- `@PickDto(dto, keys, options)` - Create DTO with selected fields
- `@OmitDto(dto, keys, options)` - Create DTO excluding fields
- `@PartialDto(dto, options)` - Create DTO with all fields optional
- `@MergeDto(dtos, options)` - Create DTO by merging multiple DTOs

## Schema Builder

The `t` object provides type-safe schema definitions:

```typescript
t.string({ minLength: 1, maxLength: 100, pattern: "^[a-z]+$" })
t.uuid({ description: "Unique identifier" })
t.dateTime()
t.number({ minimum: 0, maximum: 100, exclusiveMaximum: true })
t.integer({ multipleOf: 5 })
t.boolean()
t.array(t.string(), { minItems: 1, maxItems: 10 })
t.object({ name: t.string(), age: t.integer() })
t.record(t.string())
t.enum(["active", "inactive"])
t.literal("admin")
t.union([t.string(), t.integer()])
t.ref(SomeDto)
t.any()
t.null()
t.optional(schema)
t.nullable(schema)
```

## OpenAPI Documentation

Enable OpenAPI documentation:

```typescript
createExpressApp({
  controllers: [MyController],
  openApi: {
    info: {
      title: "My API",
      version: "1.0.0",
      description: "API description"
    },
    servers: [{ url: "https://api.example.com", description: "Production" }],
    path: "/openapi.json",        // JSON spec path (default: /openapi.json)
    docs: true,                    // Enable Swagger UI (default: /docs)
    docs: {
      path: "/docs",               // Swagger UI path
      title: "API Docs",
      swaggerUiUrl: "https://unpkg.com/swagger-ui-dist@5"
    }
  }
});
```

## Metal ORM Integration

### CRUD DTOs

Automatically create CRUD DTOs from Metal entities:

```typescript
import { User } from "./entities";
import { createMetalCrudDtoClasses, createMetalDtoOverrides } from "adorn-api";

const overrides = createMetalDtoOverrides(User, {
  overrides: {
    email: t.nullable(t.string({ format: "email" }))
  }
});

const crud = createMetalCrudDtoClasses(User, {
  overrides,
  response: { description: "User response" },
  mutationExclude: ["id", "createdAt"]
});

const { UserDto, CreateUserDto, UpdateUserDto, UserParamsDto } = crud;
```

### Pagination

```typescript
import { createPagedQueryDtoClass, createPagedResponseDtoClass, parsePagination } from "adorn-api";

const PagedQueryDto = createPagedQueryDtoClass({
  name: "PagedQueryDto",
  defaultPageSize: 20,
  maxPageSize: 100
});

const PagedResponseDto = createPagedResponseDtoClass({
  name: "PagedResponseDto",
  itemDto: UserDto
});

// In controller:
@Get("/")
@Query(PagedQueryDto)
@Returns(PagedResponseDto)
async list(ctx: RequestContext<unknown, PagedQueryDto>) {
  const pagination = parsePagination(ctx.query);
  // Use pagination for queries...
}
```

### Filtering

```typescript
import { createPagedFilterQueryDtoClass, createFilterMappings, parseFilter } from "adorn-api";

const UserQueryDto = createPagedFilterQueryDtoClass({
  name: "UserQueryDto",
  filters: {
    nameContains: { schema: t.string(), operator: "contains" },
    ageGte: { schema: t.integer(), operator: "gte" },
    active: { schema: t.boolean() }
  }
});

// In controller:
const filterMappings = createFilterMappings(User, {
  nameContains: "name",
  ageGte: "age",
  active: "active"
});
const filters = parseFilter(ctx.query, filterMappings);
```

## Error Handling

### HttpError

```typescript
import { HttpError } from "adorn-api";

// Simple error
throw new HttpError(404, "User not found");

// With body
throw new HttpError(400, "Validation failed", {
  errors: [{ field: "email", message: "Invalid email" }]
});

// With headers
throw new HttpError(401, "Unauthorized", undefined, {
  "WWW-Authenticate": 'Bearer realm="api"'
});

// With options object
throw new HttpError({
  status: 500,
  message: "Internal error",
  body: { code: "INTERNAL_ERROR" },
  cause: originalError
});
```

### Error DTOs

```typescript
import { createErrorDtoClass, SimpleErrorDto, StandardErrorDto, Errors } from "adorn-api";

const ValidationErrorDto = createErrorDtoClass({
  name: "ValidationErrorDto",
  schema: t.object({
    field: t.string(),
    message: t.string()
  })
});

// In controller:
@Get("/:id")
@Params(UserParamsDto)
@Returns(UserDto)
@Errors(SimpleErrorDto, [
  { status: 400, description: "Invalid user ID" },
  { status: 404, description: "User not found" }
])
async getOne(ctx: RequestContext<unknown, UserParamsDto>) {
  // ...
}
```

## Input Coercion

Configure input coercion for query and path parameters:

```typescript
createExpressApp({
  controllers: [MyController],
  inputCoercion: "safe"   // "safe" | "strict" | false
});
```

- **safe**: Coerces values, ignores failures
- **strict**: Coerces values, throws on failures
- **false**: Disables coercion

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Run examples
npm run example basic
```

## TypeScript Configuration

Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,
    "useDefineForClassFields": true
  }
}
```

Adorn API uses standard ECMAScript decorators (Stage 3).

## License

Check the package for license information.
