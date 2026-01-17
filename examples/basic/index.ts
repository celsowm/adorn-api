import {
  Body,
  Controller,
  Dto,
  Field,
  Get,
  Params,
  Post,
  Returns,
  buildOpenApi,
  createExpressApp,
  t,
  type RequestContext
} from "../../src";

@Dto({ description: "User record returned by the API." })
class UserDto {
  @Field(t.uuid({ description: "User identifier." }))
  id!: string;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.string()))
  nickname?: string;
}

@Dto()
class CreateUserDto {
  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.string()))
  nickname?: string;
}

@Dto()
class UserParamsDto {
  @Field(t.uuid())
  id!: string;
}

@Controller("/users")
class UserController {
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

const app = createExpressApp({ controllers: [UserController] });

app.get("/openapi.json", (_req, res) => {
  res.json(
    buildOpenApi({
      info: {
        title: "Adorn API",
        version: "1.0.0"
      }
    })
  );
});

app.listen(3000, () => {
  console.log("Adorn API running on http://localhost:3000");
});
