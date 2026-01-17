import {
  Body,
  Controller,
  Dto,
  Field,
  Get,
  OmitDto,
  Params,
  PickDto,
  Post,
  Returns,
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

interface CreateUserDto extends Omit<UserDto, "id"> {}

@OmitDto(UserDto, ["id"])
class CreateUserDto {}

interface UserParamsDto extends Pick<UserDto, "id"> {}

@PickDto(UserDto, ["id"])
class UserParamsDto {}

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

const app = createExpressApp({
  controllers: [UserController],
  openApi: {
    info: {
      title: "Adorn API",
      version: "1.0.0"
    },
    docs: true
  }
});

app.listen(3000, () => {
  console.log("Adorn API running on http://localhost:3000");
});
