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
  coerce,
  type RequestContext
} from "../../src";
import { applyFilter, toPagedResponse } from "metal-orm";
import type { SimpleWhereInput } from "metal-orm";
import { entityRef, selectFromEntity } from "metal-orm";
import { createSession } from "./db";
import {
  CreateUserDto,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ReplaceUserDto,
  UpdateUserDto,
  UserDto,
  UserErrors,
  UserParamsDto,
  UserPagedResponseDto,
  UserQueryDto
} from "./user.dtos";
import { User } from "./user.entity";

function parseUserId(value: string): number {
  const id = coerce.id(value);
  if (id === undefined) {
    throw new HttpError(400, "Invalid user id.");
  }
  return id;
}

const userRef = entityRef(User);

type UserFilter = SimpleWhereInput<typeof User, "name" | "email">;
type OrmSession = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: OrmSession) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

async function getUserOrThrow(session: OrmSession, id: number): Promise<User> {
  const user = await session.find(User, id);
  if (!user) {
    throw new HttpError(404, "User not found.");
  }
  return user;
}

function buildUserFilter(query?: UserQueryDto): UserFilter | undefined {
  if (!query) {
    return undefined;
  }
  const filter: UserFilter = {};
  if (query.nameContains) {
    filter.name = { contains: query.nameContains };
  }
  if (query.emailContains) {
    filter.email = { contains: query.emailContains };
  }
  return Object.keys(filter).length ? filter : undefined;
}

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(UserPagedResponseDto)
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    const page =
      coerce.integer(ctx.query?.page, { min: 1, clamp: true }) ?? 1;
    const pageSize =
      coerce.integer(ctx.query?.pageSize, {
        min: 1,
        max: MAX_PAGE_SIZE,
        clamp: true
      }) ?? DEFAULT_PAGE_SIZE;
    return withSession(async (session) => {
      const filters = buildUserFilter(ctx.query);
      const query = applyFilter(
        selectFromEntity(User).orderBy(userRef.id, "ASC"),
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
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    return withSession(async (session) => {
      const user = await getUserOrThrow(session, id);
      return user as UserDto;
    });
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  async create(ctx: RequestContext<CreateUserDto>) {
    return withSession(async (session) => {
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
  async replace(ctx: RequestContext<ReplaceUserDto, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    return withSession(async (session) => {
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
  async update(ctx: RequestContext<UpdateUserDto, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    return withSession(async (session) => {
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

  @Delete("/:id")
  @Params(UserParamsDto)
  @Returns({ status: 204 })
  @UserErrors
  async remove(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    return withSession(async (session) => {
      const user = await getUserOrThrow(session, id);
      await session.remove(user);
      await session.commit();
    });
  }
}
