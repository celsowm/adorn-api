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
  CreateAlbumDto,
  CreateAlbumTrackDto,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ReplaceAlbumDto,
  UpdateAlbumDto,
  AlbumDto,
  AlbumErrors,
  AlbumParamsDto,
  AlbumPagedResponseDto,
  AlbumQueryDto
} from "./album.dtos";
import {
  TrackDto,
  TrackPagedQueryDto,
  TrackPagedResponseDto,
  DEFAULT_PAGE_SIZE as TRACK_DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE as TRACK_MAX_PAGE_SIZE
} from "./track.dtos";
import { Album as AlbumEntity } from "./album.entity";
import { Artist } from "./artist.entity";
import { Track as TrackEntity } from "./track.entity";

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

function requireAlbumId(value: unknown): number {
  const id = parseInteger(value, { min: 1 });
  if (id === undefined) {
    const message = "Invalid album id.";
    throw new HttpError(
      400,
      message,
      buildErrorBody(message, "INVALID_ALBUM_ID", [{ field: "id", message }])
    );
  }
  return id;
}

const albumRef = entityRef(AlbumEntity);
const trackRef = entityRef(TrackEntity);

type AlbumFilter = SimpleWhereInput<typeof AlbumEntity, "title" | "releaseYear" | "artistId">;
type AlbumTrackFilter = SimpleWhereInput<typeof TrackEntity, "albumId">;
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

async function getAlbumOrThrow(session: OrmSession, id: number): Promise<AlbumEntity> {
  const album = await session.find(AlbumEntity, id);
  if (!album) {
    const message = "Album not found.";
    throw new HttpError(404, message, buildErrorBody(message, "ALBUM_NOT_FOUND"));
  }
  return album;
}

async function getArtistOrThrow(session: OrmSession, id: number): Promise<Artist> {
  const artist = await session.find(Artist, id);
  if (!artist) {
    const message = "Artist not found.";
    throw new HttpError(404, message, buildErrorBody(message, "ARTIST_NOT_FOUND"));
  }
  return artist;
}

function buildAlbumFilter(query?: AlbumQueryDto): AlbumFilter | undefined {
  if (!query) {
    return undefined;
  }
  const filter: AlbumFilter = {};
  if (query.titleContains) {
    filter.title = { contains: query.titleContains };
  }
  if (query.releaseYear !== undefined) {
    (filter as any).releaseYear = { equals: query.releaseYear };
  }
  if (query.artistId !== undefined) {
    filter.artistId = { equals: query.artistId };
  }
  return Object.keys(filter).length ? filter : undefined;
}

@Controller("/albums")
export class AlbumController {
  @Get("/")
  @Query(AlbumQueryDto)
  @Returns(AlbumPagedResponseDto)
  async list(ctx: RequestContext<unknown, AlbumQueryDto>) {
    const page =
      parseInteger(ctx.query?.page, { min: 1, clamp: true }) ?? 1;
    const pageSize =
      parseInteger(ctx.query?.pageSize, {
        min: 1,
        max: MAX_PAGE_SIZE,
        clamp: true
      }) ?? DEFAULT_PAGE_SIZE;
    return withSession(async (session) => {
      const filters = buildAlbumFilter(ctx.query);
      const query = applyFilter(
        selectFromEntity(AlbumEntity).orderBy(albumRef.id, "ASC"),
        AlbumEntity,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Get("/:id")
  @Params(AlbumParamsDto)
  @Returns(AlbumDto)
  @AlbumErrors
  async getOne(ctx: RequestContext<unknown, undefined, AlbumParamsDto>) {
    const id = requireAlbumId(ctx.params.id);
    return withSession(async (session) => {
      const album = await getAlbumOrThrow(session, id);
      return album as AlbumDto;
    });
  }

  @Post("/")
  @Body(CreateAlbumDto)
  @Returns({ status: 201, schema: AlbumDto })
  async create(ctx: RequestContext<CreateAlbumDto>) {
    return withSession(async (session) => {
      await getArtistOrThrow(session, ctx.body.artistId);
      const album = new AlbumEntity();
      album.title = ctx.body.title;
      album.releaseYear = ctx.body.releaseYear ?? null;
      album.artistId = ctx.body.artistId;
      album.createdAt = new Date().toISOString();
      await session.persist(album);
      await session.commit();
      return album as AlbumDto;
    });
  }

  @Put("/:id")
  @Params(AlbumParamsDto)
  @Body(ReplaceAlbumDto)
  @Returns(AlbumDto)
  @AlbumErrors
  async replace(ctx: RequestContext<ReplaceAlbumDto, undefined, AlbumParamsDto>) {
    const id = requireAlbumId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getAlbumOrThrow(session, id);
      entity.title = ctx.body.title;
      entity.releaseYear = ctx.body.releaseYear ?? null;
      await session.commit();
      return entity as AlbumDto;
    });
  }

  @Patch("/:id")
  @Params(AlbumParamsDto)
  @Body(UpdateAlbumDto)
  @Returns(AlbumDto)
  @AlbumErrors
  async update(ctx: RequestContext<UpdateAlbumDto, undefined, AlbumParamsDto>) {
    const id = requireAlbumId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getAlbumOrThrow(session, id);
      if (ctx.body.title !== undefined) {
        entity.title = ctx.body.title;
      }
      if (ctx.body.releaseYear !== undefined) {
        entity.releaseYear = ctx.body.releaseYear ?? null;
      }
      await session.commit();
      return entity as AlbumDto;
    });
  }

  @Get("/:id/tracks")
  @Params(AlbumParamsDto)
  @Query(TrackPagedQueryDto)
  @Returns(TrackPagedResponseDto)
  @AlbumErrors
  async listTracks(
    ctx: RequestContext<unknown, TrackPagedQueryDto, AlbumParamsDto>
  ) {
    const id = requireAlbumId(ctx.params.id);
    const page =
      parseInteger(ctx.query?.page, { min: 1, clamp: true }) ?? 1;
    const pageSize =
      parseInteger(ctx.query?.pageSize, {
        min: 1,
        max: TRACK_MAX_PAGE_SIZE,
        clamp: true
      }) ?? TRACK_DEFAULT_PAGE_SIZE;
    return withSession(async (session) => {
      await getAlbumOrThrow(session, id);
      const filters: AlbumTrackFilter = {
        albumId: { equals: id }
      };
      const query = applyFilter(
        selectFromEntity(TrackEntity).orderBy(trackRef.id, "ASC"),
        TrackEntity,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Post("/:id/tracks")
  @Params(AlbumParamsDto)
  @Body(CreateAlbumTrackDto)
  @Returns({ status: 201, schema: TrackDto })
  @AlbumErrors
  async createTrack(
    ctx: RequestContext<CreateAlbumTrackDto, undefined, AlbumParamsDto>
  ) {
    const id = requireAlbumId(ctx.params.id);
    return withSession(async (session) => {
      const album = await getAlbumOrThrow(session, id);
      const track = album.tracks.add({
        title: ctx.body.title,
        durationSeconds: ctx.body.durationSeconds ?? null,
        trackNumber: ctx.body.trackNumber ?? null,
        createdAt: new Date().toISOString()
      });
      await session.commit();
      return track as TrackDto;
    });
  }

  @Delete("/:id")
  @Params(AlbumParamsDto)
  @Returns({ status: 204 })
  @AlbumErrors
  async remove(ctx: RequestContext<unknown, undefined, AlbumParamsDto>) {
    const id = requireAlbumId(ctx.params.id);
    return withSession(async (session) => {
      const album = await getAlbumOrThrow(session, id);
      await session.remove(album);
      await session.commit();
    });
  }
}
