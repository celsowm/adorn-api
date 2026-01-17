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

## Notes

- Uses the TC39 stage-3 decorator semantics (TypeScript 5+).
- DTO schemas are defined without zod; use `t` helpers and `@Field`.
- OpenAPI 3.1 JSON Schema dialect is emitted for Swagger UI.
- When `openApi` is enabled, the spec is served at `/openapi.json` by default.
- When `openApi.docs` is enabled, Swagger UI is available at `/docs`.
