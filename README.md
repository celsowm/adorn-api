# Adorn API (Stage 3 Decorators)

Decorator-first micro framework with Express adapter and OpenAPI 3.1 generation.

## Quick start

```ts
import {
  Body,
  Controller,
  Dto,
  Field,
  Get,
  Post,
  Returns,
  createExpressApp,
  t
} from "./src";

@Dto()
class CreateUserDto {
  @Field(t.string({ minLength: 1 }))
  name!: string;
}

@Dto()
class UserDto {
  @Field(t.uuid())
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;
}

@Controller("/users")
class UserController {
  @Get("/")
  @Returns(UserDto)
  list() {
    return [{ id: "demo", name: "Ada" }];
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  create(ctx: { body: CreateUserDto }) {
    return { id: "demo", name: ctx.body.name };
  }
}

const app = createExpressApp({ controllers: [UserController] });
const app = createExpressApp({
  controllers: [UserController],
  openApi: {
    info: { title: "Adorn API", version: "1.0.0" },
    docs: true
  }
});
app.listen(3000);
```

## Examples

Run the default example:

```sh
npm run example
```

Run a specific example:

```sh
npm run example -- openapi
```

## Helpers

Coercion helpers keep request parsing consistent:

```ts
import { coerce } from "./src";

const id = coerce.id(ctx.params.id);
const limit = coerce.integer(ctx.query.limit, { min: 1, max: 100, clamp: true }) ?? 25;
```

Metal-ORM helpers reduce boilerplate:

```ts
import {
  withSession,
  parseIdOrThrow,
  parsePagination,
  parseFilter,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass
} from "./src/adapter/metal-orm";

// Session management with automatic cleanup
return withSession(createSession, async (session) => {
  const user = await session.find(User, id);
  return user;
});

// Parse and validate ID
const id = parseIdOrThrow(ctx.params.id, "user");

// Parse pagination with defaults
const { page, pageSize } = parsePagination(ctx.query ?? {});

// Build filters from query parameters
const filters = parseFilter<User, "name">(ctx.query, {
  nameContains: { field: "name" as const, operator: "contains" as const }
});

// Generate pagination DTOs
const PagedQueryDto = createPagedQueryDtoClass({ maxPageSize: 100 });
const UserPagedResponseDto = createPagedResponseDtoClass({ itemDto: UserDto });
```

See [METAL_ORM_HELPERS.md](./METAL_ORM_HELPERS.md) for detailed documentation.

## Notes

- Uses the TC39 stage-3 decorator semantics (TypeScript 5+).
- DTO schemas are defined without zod; use `t` helpers and `@Field`.
- OpenAPI 3.1 JSON Schema dialect is emitted for Swagger UI.
- When `openApi` is enabled, the spec is served at `/openapi.json` by default.
- When `openApi.docs` is enabled, Swagger UI is available at `/docs`.
