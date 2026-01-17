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
  t,
  type RequestContext
} from "../../src";
import {
  entityRef,
  eq,
  getTableDefFromEntity,
  selectFromEntity
} from "metal-orm";
import { createSession } from "./db";
import {
  CreateUserDto,
  ReplaceUserDto,
  UpdateUserDto,
  UserDto,
  UserErrors,
  UserParamsDto,
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

@Controller("/users")
export class UserController {
  @Get("/")
  @Query(UserQueryDto)
  @Returns(t.array(t.ref(UserDto)))
  async list(ctx: RequestContext<unknown, UserQueryDto>) {
    const offset =
      coerce.integer(ctx.query?.offset, { min: 0, clamp: true }) ?? 0;
    const limit =
      coerce.integer(ctx.query?.limit, { min: 1, max: 100, clamp: true });
    const session = createSession();
    try {
      const U = entityRef(User);
      const query = selectFromEntity(User).orderBy(U.id, "ASC");
      if (offset > 0) {
        query.offset(offset);
      }
      if (limit !== undefined) {
        query.limit(limit);
      }
      return await query.execute(session);
    } finally {
      await session.dispose();
    }
  }

  @Get("/:id")
  @Params(UserParamsDto)
  @Returns(UserDto)
  @UserErrors
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    const session = createSession();
    try {
      const U = entityRef(User);
      const [user] = await selectFromEntity(User)
        .where(eq(U.id, id))
        .execute(session);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      return user as UserDto;
    } finally {
      await session.dispose();
    }
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  async create(ctx: RequestContext<CreateUserDto>) {
    const session = createSession();
    try {
      const userTable = getTableDefFromEntity(User);
      if (!userTable) {
        throw new Error("User table not initialized");
      }
      const user = new User();
      user.name = ctx.body.name;
      user.email = ctx.body.email ?? null;
      user.createdAt = new Date().toISOString();
      session.trackNew(userTable, user);
      await session.commit();
      return user as UserDto;
    } finally {
      await session.dispose();
    }
  }

  @Put("/:id")
  @Params(UserParamsDto)
  @Body(ReplaceUserDto)
  @Returns(UserDto)
  @UserErrors
  async replace(ctx: RequestContext<ReplaceUserDto, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    const session = createSession();
    try {
      const U = entityRef(User);
      const [user] = await selectFromEntity(User)
        .where(eq(U.id, id))
        .execute(session);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      const entity = user as User;
      entity.name = ctx.body.name;
      entity.email = ctx.body.email ?? null;
      await session.commit();
      return entity as UserDto;
    } finally {
      await session.dispose();
    }
  }

  @Patch("/:id")
  @Params(UserParamsDto)
  @Body(UpdateUserDto)
  @Returns(UserDto)
  @UserErrors
  async update(ctx: RequestContext<UpdateUserDto, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    const session = createSession();
    try {
      const U = entityRef(User);
      const [user] = await selectFromEntity(User)
        .where(eq(U.id, id))
        .execute(session);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      const entity = user as User;
      if (ctx.body.name !== undefined) {
        entity.name = ctx.body.name;
      }
      if (ctx.body.email !== undefined) {
        entity.email = ctx.body.email ?? null;
      }
      await session.commit();
      return entity as UserDto;
    } finally {
      await session.dispose();
    }
  }

  @Delete("/:id")
  @Params(UserParamsDto)
  @Returns({ status: 204 })
  @UserErrors
  async remove(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseUserId(ctx.params.id);
    const session = createSession();
    try {
      const U = entityRef(User);
      const [user] = await selectFromEntity(User)
        .where(eq(U.id, id))
        .execute(session);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }
      session.markRemoved(user);
      await session.commit();
    } finally {
      await session.dispose();
    }
  }
}
