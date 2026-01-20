# Adorn API

Decorator-first web framework with OpenAPI 3.1 schema generation, built on top of Express.

## Features

- **Decorator-First API**: Define APIs using TypeScript decorators for controllers, routes, and DTOs
- **Automatic OpenAPI 3.1 Generation**: Swagger UI documentation auto-generated from your code
- **Type-Safe DTOs**: Data Transfer Objects with built-in validation and serialization
- **Input Coercion**: Automatic type conversion and validation of HTTP inputs
- **Error Handling**: Comprehensive error handling with custom error responses
- **Metal ORM Integration**: Built-in support for Metal ORM with CRUD operations and pagination
- **Express Integration**: Lightweight adapter for Express.js
- **Type Safety**: Full TypeScript support with type inferencing

## Installation

```bash
npm install adorn-api
```

## Quick Start

### 1. Define DTOs

```typescript
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

### 3. Create and Start the App

```typescript
import { createExpressApp } from "adorn-api";
import { UserController } from "./user.controller";

export function createApp() {
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

// Start the server
const app = createApp();
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("Documentation available at http://localhost:3000/docs");
});
```

## Documentation

### Controllers

Controllers are classes decorated with `@Controller()` that group related API endpoints.

```typescript
@Controller("/api/v1/users")
export class UserController {
  // Endpoints here
}
```

### Routes

Routes are methods decorated with HTTP method decorators:

- `@Get(path)` - GET request
- `@Post(path)` - POST request
- `@Put(path)` - PUT request
- `@Patch(path)` - PATCH request
- `@Delete(path)` - DELETE request

```typescript
@Get("/")
@Returns(t.array(UserDto))
async listUsers() {
  return users;
}
```

### Inputs

Use decorators to define and validate request inputs:

- `@Body(schema)` - Request body
- `@Query(schema)` - Query parameters
- `@Params(schema)` - Path parameters
- `@Headers(schema)` - Request headers

```typescript
@Get("/:id")
@Params(UserParamsDto)
@Query(PaginationDto)
@Returns(UserDto)
async getUser(ctx: RequestContext<unknown, PaginationDto, { id: string }>) {
  // ctx.params.id is typed as string
  // ctx.query is typed as PaginationDto
}
```

### Responses

Use `@Returns()` decorator to document responses:

```typescript
@Returns(UserDto) // 200 OK with UserDto
@Returns({ status: 201, schema: UserDto, description: "Created" })
@ReturnsError(ValidationErrorDto) // 400+ error response
@Errors(ApiErrorDto, [
  { status: 404, description: "Not Found" },
  { status: 401, description: "Unauthorized" }
])
```

### DTOs (Data Transfer Objects)

DTOs define the shape of data sent to and from your API:

```typescript
@Dto({ 
  description: "User data",
  additionalProperties: false // Disallow extra properties
})
export class UserDto {
  @Field(t.uuid({ description: "Unique identifier" }))
  id!: string;

  @Field(t.string({ 
    minLength: 1, 
    maxLength: 100, 
    description: "Full name" 
  }))
  name!: string;

  @Field(t.optional(t.email({ description: "Email address" })))
  email?: string;

  @Field(t.array(t.string({ description: "User roles" })))
  roles!: string[];
}
```

### DTO Composition

Create new DTOs by composing existing ones:

```typescript
// Pick specific fields
@PickDto(UserDto, ["id", "name"])
export class UserSummaryDto {}

// Omit specific fields
@OmitDto(UserDto, ["password"])
export class PublicUserDto {}

// Make all fields optional
@PartialDto(UserDto)
export class UpdateUserDto {}

// Merge multiple DTOs
@MergeDto([UserDto, AddressDto])
export class UserWithAddressDto {}
```

### Schema Types

The `t` (type) object provides schema builders for all JSON types:

- Primitives: `t.string()`, `t.number()`, `t.integer()`, `t.boolean()`, `t.null()`
- Formats: `t.uuid()`, `t.email()`, `t.dateTime()`
- Complex: `t.array()`, `t.object()`, `t.record()`
- Composition: `t.union()`, `t.enum()`, `t.literal()`
- References: `t.ref()`
- Modifiers: `t.optional()`, `t.nullable()`

### Metal ORM Integration

Adorn provides seamless integration with Metal ORM:

```typescript
import { 
  MetalDto, 
  createMetalCrudDtos,
  parsePagination,
  type RequestContext
} from "adorn-api";
import { User } from "./user.entity";

// Generate CRUD DTOs from Metal ORM entity
const {
  CreateDto,
  UpdateDto,
  ReplaceDto,
  ResponseDto,
  ParamsDto
} = createMetalCrudDtos(User);

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(PaginationQueryDto)
  @Returns(ResponseDto)
  async list(ctx: RequestContext<unknown, PaginationQueryDto>) {
    const { page, pageSize } = parsePagination(ctx.query);
    // Query with pagination...
  }

  @Post("/")
  @Body(CreateDto)
  @Returns({ status: 201, schema: ResponseDto })
  async create(ctx: RequestContext<typeof CreateDto>) {
    // Create user...
  }
}
```

### Error Handling

Throw `HttpError` for HTTP error responses:

```typescript
import { HttpError } from "adorn-api";

throw new HttpError(404, "User not found");

// With custom body and headers
throw new HttpError({
  status: 400,
  message: "Validation failed",
  body: { 
    errors: ["Email is invalid", "Password is too short"] 
  },
  headers: { "X-Error-Code": "VALIDATION_ERROR" }
});
```

### OpenAPI Configuration

Customize the OpenAPI generation:

```typescript
createExpressApp({
  controllers: [UserController],
  openApi: {
    info: {
      title: "My API",
      version: "2.0.0",
      description: "API documentation"
    },
    servers: [
      { url: "https://api.example.com/v1", description: "Production" },
      { url: "http://localhost:3000", description: "Development" }
    ],
    path: "/api-docs.json", // OpenAPI JSON endpoint
    docs: {
      path: "/api-docs", // Swagger UI path
      title: "API Documentation",
      swaggerUiUrl: "https://unpkg.com/swagger-ui-dist@5"
    }
  }
});
```

### Input Coercion

Configure input coercion behavior:

```typescript
createExpressApp({
  controllers: [UserController],
  inputCoercion: "strict" // "safe" (default), "strict", or false
});
```

- **safe**: Attempt to coerce values to the expected type
- **strict**: Throw errors for invalid inputs
- **false**: Disable coercion entirely

## Examples

Check the `examples/` directory for complete examples:

- **basic**: Simple API with DTOs and controllers
- **metal-orm-sqlite**: Full CRUD API with Metal ORM and SQLite
- **metal-orm-sqlite-music**: Complex API with relationships
- **restful**: RESTful API example
- **openapi**: OpenAPI customization example

## Build and Test

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run an example
npm run example -- basic
```

## License

MIT
