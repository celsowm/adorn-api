import {
  Body,
  Controller,
  Delete,
  Get,
  HttpError,
  Params,
  Patch,
  Post,
  Put,
  Query,
  Returns,
  MetalDto,
  OmitDto,
  PartialDto,
  PickDto,
  MergeDto,
  Dto,
  Field,
  Errors,
  t,
  type RequestContext
} from "../../src";
import { applyFilter, toPagedResponse, selectFromEntity, entityRef } from "metal-orm";
import { createSession } from "./db";
import {
  withSession,
  parsePagination,
  parseFilter,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass
} from "../../src/adapter/metal-orm";
import { User } from "./user.entity";
import { PostDto } from "./post.dtos";

const userRef = entityRef(User);

const USER_DTO_OVERRIDES = {
  id: t.integer({ description: "User id." }),
  name: t.string({ minLength: 1 }),
  email: t.nullable(t.string({ format: "email" })),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

@MetalDto(User, {
  description: "User returned by the API.",
  overrides: USER_DTO_OVERRIDES
})
export class UserDto {
  declare id: number;
  declare name: string;
  declare email?: string | null;
  declare createdAt: string;
}

@Dto()
class UserPostsDto {
  @Field(t.array(t.ref(PostDto)))
  posts!: PostDto[];
}

@MergeDto([UserDto, UserPostsDto], {
  description: "User returned by the API with posts."
})
class UserWithPostsDto {}

const USER_MUTATION_KEYS: Array<keyof UserDto> = ["id", "createdAt"];

@OmitDto(UserDto, USER_MUTATION_KEYS)
export class CreateUserDto {
  declare name: string;
  declare email?: string | null;
}

@OmitDto(UserDto, USER_MUTATION_KEYS)
export class ReplaceUserDto {
  declare name: string;
  declare email?: string | null;
}

@PartialDto(ReplaceUserDto)
export class UpdateUserDto {
  declare name?: string;
  declare email?: string | null;
}

@PickDto(UserDto, ["id"])
export class UserParamsDto {
  declare id: number;
}

const PagedQueryDto = createPagedQueryDtoClass({
  name: "UserPagedQueryDto"
});

@Dto()
class UserFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  nameContains?: string;

  @Field(t.optional(t.string({ minLength: 1 })))
  emailContains?: string;
}

@MergeDto([PagedQueryDto, UserFilterQueryDto])
export class UserQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare nameContains?: string;
  declare emailContains?: string;
}

const UserWithPostsPagedResponseDto = createPagedResponseDtoClass({
  itemDto: UserWithPostsDto,
  description: "Paged user list response with posts.",
  name: "UserWithPostsPagedResponseDto"
});

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const UserErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid user id." },
  { status: 404, description: "User not found." }
]);

const USER_FILTER_MAPPINGS = {
  nameContains: { field: "name" as const, operator: "contains" as const },
  emailContains: { field: "email" as const, operator: "contains" as const }
};

type IntegerOptions = {
  min?: number;
  max?: number;
  clamp?: boolean;
};

function parseInteger(value: unknown, options: IntegerOptions = {}): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }
  const result = value;
  if (options.min !== undefined && result < options.min) {
    return options.clamp ? options.min : undefined;
  }
  if (options.max !== undefined && result > options.max) {
    return options.clamp ? options.max : undefined;
  }
  return result;
}

function requireUserId(value: unknown): number {
  const id = parseInteger(value, { min: 1 });
  if (id === undefined) {
    throw new HttpError(400, "Invalid user id.");
  }
  return id;
}

async function getUserOrThrow(session: any, id: number): Promise<User> {
  const user = await session.find(User, id);
  if (!user) {
    throw new HttpError(404, "User not found.");
  }
  return user;
}

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserWithPostsPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    return withSession(createSession, async (session) => {
      const { page, pageSize } = parsePagination(ctx.query ?? {});
      const filters = parseFilter<User, "name" | "email">(ctx.query, USER_FILTER_MAPPINGS);
      const query = applyFilter(
        selectFromEntity(User)
          .orderBy(userRef.id, "ASC")
          .include("posts", {
            columns: ["id", "title", "body", "userId", "createdAt"]
          }),
        User,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Get("/:id")
  @Params(UserParamsDto)
  @Returns(UserDto)
  @UserErrors
  async getOne(ctx: RequestContext<unknown, undefined, UserParamsDto>) {
    return withSession(createSession, async (session) => {
      const id = requireUserId(ctx.params.id);
      const user = await getUserOrThrow(session, id);
      return user as UserDto;
    });
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  async create(ctx: RequestContext<CreateUserDto>) {
    return withSession(createSession, async (session) => {
      const user = new User();
      user.name = ctx.body.name;
      user.email = ctx.body.email ?? null;
      user.createdAt = new Date().toISOString();
      await session.persist(user);
      await session.commit();
      return user as UserDto;
    });
  }

  @Put("/:id")
  @Params(UserParamsDto)
  @Body(ReplaceUserDto)
  @Returns(UserDto)
  @UserErrors
  async replace(ctx: RequestContext<ReplaceUserDto, undefined, UserParamsDto>) {
    return withSession(createSession, async (session) => {
      const id = requireUserId(ctx.params.id);
      const entity = await getUserOrThrow(session, id);
      entity.name = ctx.body.name;
      entity.email = ctx.body.email ?? null;
      await session.commit();
      return entity as UserDto;
    });
  }

  @Patch("/:id")
  @Params(UserParamsDto)
  @Body(UpdateUserDto)
  @Returns(UserDto)
  @UserErrors
  async update(ctx: RequestContext<UpdateUserDto, undefined, UserParamsDto>) {
    return withSession(createSession, async (session) => {
      const id = requireUserId(ctx.params.id);
      const entity = await getUserOrThrow(session, id);
      if (ctx.body.name !== undefined) {
        entity.name = ctx.body.name;
      }
      if (ctx.body.email !== undefined) {
        entity.email = ctx.body.email ?? null;
      }
      await session.commit();
      return entity as UserDto;
    });
  }

  @Get("/:id/posts")
  @Params(UserParamsDto)
  @Returns(t.array(t.ref(PostDto)))
  @UserErrors
  async listPosts(ctx: RequestContext<unknown, undefined, UserParamsDto>) {
    return withSession(createSession, async (session) => {
      const id = requireUserId(ctx.params.id);
      const user = await getUserOrThrow(session, id);
      return (await user.posts.load()) as PostDto[];
    });
  }

  @Post("/:id/posts")
  @Params(UserParamsDto)
  @Body({
    title: t.string({ minLength: 1 }),
    body: t.nullable(t.string())
  })
  @Returns({ status: 201, schema: PostDto })
  @UserErrors
  async createPost(
    ctx: RequestContext<{ title: string; body?: string | null }, undefined, UserParamsDto>
  ) {
    return withSession(createSession, async (session) => {
      const id = requireUserId(ctx.params.id);
      const user = await getUserOrThrow(session, id);
      const post = user.posts.add({
        title: ctx.body.title,
        body: ctx.body.body ?? null,
        createdAt: new Date().toISOString()
      });
      await session.commit();
      return post as PostDto;
    });
  }

  @Delete("/:id")
  @Params(UserParamsDto)
  @Returns({ status: 204 })
  @UserErrors
  async remove(ctx: RequestContext<unknown, undefined, UserParamsDto>) {
    return withSession(createSession, async (session) => {
      const id = requireUserId(ctx.params.id);
      const user = await getUserOrThrow(session, id);
      await session.remove(user);
      await session.commit();
    });
  }
}
