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
  type RequestContext
} from "../../src";
import { applyFilter, toPagedResponse } from "metal-orm";
import type { SimpleWhereInput } from "metal-orm";
import { entityRef, selectFromEntity } from "metal-orm";
import { createSession } from "./db";
import {
  CreatePostDto,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PostDto,
  PostErrors,
  PostParamsDto,
  PostPagedResponseDto,
  PostQueryDto,
  ReplacePostDto,
  UpdatePostDto
} from "./post.dtos";
import { Post as PostEntity } from "./post.entity";
import { User } from "./user.entity";

type IntegerOptions = {
  min?: number;
  max?: number;
  clamp?: boolean;
};

function parseInteger(value: unknown, options: IntegerOptions = {}): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }
  let result = value;
  if (options.min !== undefined && result < options.min) {
    return options.clamp ? options.min : undefined;
  }
  if (options.max !== undefined && result > options.max) {
    return options.clamp ? options.max : undefined;
  }
  return result;
}

function requirePostId(value: unknown): number {
  const id = parseInteger(value, { min: 1 });
  if (id === undefined) {
    throw new HttpError(400, "Invalid post id.");
  }
  return id;
}

const postRef = entityRef(PostEntity);

type PostFilter = SimpleWhereInput<typeof PostEntity, "title" | "userId">;
type OrmSession = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: OrmSession) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

async function getPostOrThrow(session: OrmSession, id: number): Promise<PostEntity> {
  const post = await session.find(PostEntity, id);
  if (!post) {
    throw new HttpError(404, "Post not found.");
  }
  return post;
}

async function getUserOrThrow(session: OrmSession, id: number): Promise<User> {
  const user = await session.find(User, id);
  if (!user) {
    throw new HttpError(404, "User not found.");
  }
  return user;
}

function buildPostFilter(query?: PostQueryDto): PostFilter | undefined {
  if (!query) {
    return undefined;
  }
  const filter: PostFilter = {};
  if (query.titleContains) {
    filter.title = { contains: query.titleContains };
  }
  if (query.userId !== undefined) {
    filter.userId = { equals: query.userId };
  }
  return Object.keys(filter).length ? filter : undefined;
}

@Controller("/posts")
export class PostController {
  @Get("/")
  @Query(PostQueryDto)
  @Returns(PostPagedResponseDto)
  async list(ctx: RequestContext<unknown, PostQueryDto>) {
    const page =
      parseInteger(ctx.query?.page, { min: 1, clamp: true }) ?? 1;
    const pageSize =
      parseInteger(ctx.query?.pageSize, {
        min: 1,
        max: MAX_PAGE_SIZE,
        clamp: true
      }) ?? DEFAULT_PAGE_SIZE;
    return withSession(async (session) => {
      const filters = buildPostFilter(ctx.query);
      const query = applyFilter(
        selectFromEntity(PostEntity).orderBy(postRef.id, "ASC"),
        PostEntity,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Get("/:id")
  @Params(PostParamsDto)
  @Returns(PostDto)
  @PostErrors
  async getOne(ctx: RequestContext<unknown, undefined, PostParamsDto>) {
    const id = requirePostId(ctx.params.id);
    return withSession(async (session) => {
      const post = await getPostOrThrow(session, id);
      return post as PostDto;
    });
  }

  @Post("/")
  @Body(CreatePostDto)
  @Returns({ status: 201, schema: PostDto })
  async create(ctx: RequestContext<CreatePostDto>) {
    return withSession(async (session) => {
      await getUserOrThrow(session, ctx.body.userId);
      const post = new PostEntity();
      post.title = ctx.body.title;
      post.body = ctx.body.body ?? null;
      post.userId = ctx.body.userId;
      post.createdAt = new Date().toISOString();
      await session.persist(post);
      await session.commit();
      return post as PostDto;
    });
  }

  @Put("/:id")
  @Params(PostParamsDto)
  @Body(ReplacePostDto)
  @Returns(PostDto)
  @PostErrors
  async replace(ctx: RequestContext<ReplacePostDto, undefined, PostParamsDto>) {
    const id = requirePostId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getPostOrThrow(session, id);
      await getUserOrThrow(session, ctx.body.userId);
      entity.title = ctx.body.title;
      entity.body = ctx.body.body ?? null;
      entity.userId = ctx.body.userId;
      await session.commit();
      return entity as PostDto;
    });
  }

  @Patch("/:id")
  @Params(PostParamsDto)
  @Body(UpdatePostDto)
  @Returns(PostDto)
  @PostErrors
  async update(ctx: RequestContext<UpdatePostDto, undefined, PostParamsDto>) {
    const id = requirePostId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getPostOrThrow(session, id);
      if (ctx.body.title !== undefined) {
        entity.title = ctx.body.title;
      }
      if (ctx.body.body !== undefined) {
        entity.body = ctx.body.body ?? null;
      }
      if (ctx.body.userId !== undefined) {
        await getUserOrThrow(session, ctx.body.userId);
        entity.userId = ctx.body.userId;
      }
      await session.commit();
      return entity as PostDto;
    });
  }

  @Delete("/:id")
  @Params(PostParamsDto)
  @Returns({ status: 204 })
  @PostErrors
  async remove(ctx: RequestContext<unknown, undefined, PostParamsDto>) {
    const id = requirePostId(ctx.params.id);
    return withSession(async (session) => {
      const post = await getPostOrThrow(session, id);
      await session.remove(post);
      await session.commit();
    });
  }
}
