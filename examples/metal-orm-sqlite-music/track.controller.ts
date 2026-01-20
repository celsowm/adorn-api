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
  parsePagination,
  type RequestContext
} from "../../src";
import { applyFilter, toPagedResponse } from "metal-orm";
import type { SimpleWhereInput } from "metal-orm";
import { entityRef, selectFromEntity } from "metal-orm";
import { createSession } from "./db";
import {
  CreateTrackDto,
  ReplaceTrackDto,
  UpdateTrackDto,
  TrackDto,
  TrackErrors,
  TrackParamsDto,
  TrackPagedResponseDto,
  TrackQueryDto,
  TrackQueryDtoClass
} from "./track.dtos";
import { Track as TrackEntity } from "./track.entity";
import { Album } from "./album.entity";

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

function requireTrackId(value: unknown): number {
  const id = parseInteger(value, { min: 1 });
  if (id === undefined) {
    const message = "Invalid track id.";
    throw new HttpError(
      400,
      message,
      buildErrorBody(message, "INVALID_TRACK_ID", [{ field: "id", message }])
    );
  }
  return id;
}

const trackRef = entityRef(TrackEntity);

type TrackFilter = SimpleWhereInput<typeof TrackEntity, "title" | "albumId">;
type OrmSession = ReturnType<typeof createSession>;

type ErrorDetail = { field: string; message: string };

function buildErrorBody(message: string, code: string, errors?: ErrorDetail[]) {
  return { message, code, errors };
}

async function withSession<T>(handler: (session: OrmSession) => Promise<T>) {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

async function getTrackOrThrow(session: OrmSession, id: number): Promise<TrackEntity> {
  const track = await session.find(TrackEntity, id);
  if (!track) {
    const message = "Track not found.";
    throw new HttpError(404, message, buildErrorBody(message, "TRACK_NOT_FOUND"));
  }
  return track;
}

async function getAlbumOrThrow(session: OrmSession, id: number): Promise<Album> {
  const album = await session.find(Album, id);
  if (!album) {
    const message = "Album not found.";
    throw new HttpError(404, message, buildErrorBody(message, "ALBUM_NOT_FOUND"));
  }
  return album;
}

function buildTrackFilter(query?: TrackQueryDto): TrackFilter | undefined {
  if (!query) {
    return undefined;
  }
  const filter: TrackFilter = {};
  if (query.titleContains) {
    filter.title = { contains: query.titleContains };
  }
  if (query.albumId !== undefined) {
    filter.albumId = { equals: query.albumId };
  }
  return Object.keys(filter).length ? filter : undefined;
}

@Controller("/tracks")
export class TrackController {
  @Get("/")
  @Query(TrackQueryDtoClass)
  @Returns(TrackPagedResponseDto)
  async list(ctx: RequestContext<unknown, TrackQueryDto>) {
    const paginationQuery = (ctx.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = parsePagination(paginationQuery);
    return withSession(async (session) => {
      const filters = buildTrackFilter(ctx.query);
      const query = applyFilter(
        selectFromEntity(TrackEntity).orderBy(trackRef.id, "ASC"),
        TrackEntity,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Get("/:id")
  @Params(TrackParamsDto)
  @Returns(TrackDto)
  @TrackErrors
  async getOne(ctx: RequestContext<unknown, undefined, TrackParamsDto>) {
    const id = requireTrackId(ctx.params.id);
    return withSession(async (session) => {
      const track = await getTrackOrThrow(session, id);
      return track as TrackDto;
    });
  }

  @Post("/")
  @Body(CreateTrackDto)
  @Returns({ status: 201, schema: TrackDto })
  async create(ctx: RequestContext<CreateTrackDto>) {
    return withSession(async (session) => {
      await getAlbumOrThrow(session, ctx.body.albumId);
      const track = new TrackEntity();
      track.title = ctx.body.title;
      track.durationSeconds = ctx.body.durationSeconds ?? null;
      track.trackNumber = ctx.body.trackNumber ?? null;
      track.albumId = ctx.body.albumId;
      track.createdAt = new Date().toISOString();
      await session.persist(track);
      await session.commit();
      return track as TrackDto;
    });
  }

  @Put("/:id")
  @Params(TrackParamsDto)
  @Body(ReplaceTrackDto)
  @Returns(TrackDto)
  @TrackErrors
  async replace(ctx: RequestContext<ReplaceTrackDto, undefined, TrackParamsDto>) {
    const id = requireTrackId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getTrackOrThrow(session, id);
      entity.title = ctx.body.title;
      entity.durationSeconds = ctx.body.durationSeconds ?? null;
      entity.trackNumber = ctx.body.trackNumber ?? null;
      await session.commit();
      return entity as TrackDto;
    });
  }

  @Patch("/:id")
  @Params(TrackParamsDto)
  @Body(UpdateTrackDto)
  @Returns(TrackDto)
  @TrackErrors
  async update(ctx: RequestContext<UpdateTrackDto, undefined, TrackParamsDto>) {
    const id = requireTrackId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getTrackOrThrow(session, id);
      if (ctx.body.title !== undefined) {
        entity.title = ctx.body.title;
      }
      if (ctx.body.durationSeconds !== undefined) {
        entity.durationSeconds = ctx.body.durationSeconds ?? null;
      }
      if (ctx.body.trackNumber !== undefined) {
        entity.trackNumber = ctx.body.trackNumber ?? null;
      }
      await session.commit();
      return entity as TrackDto;
    });
  }

  @Delete("/:id")
  @Params(TrackParamsDto)
  @Returns({ status: 204 })
  @TrackErrors
  async remove(ctx: RequestContext<unknown, undefined, TrackParamsDto>) {
    const id = requireTrackId(ctx.params.id);
    return withSession(async (session) => {
      const track = await getTrackOrThrow(session, id);
      await session.remove(track);
      await session.commit();
    });
  }
}
