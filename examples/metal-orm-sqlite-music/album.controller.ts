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
import { TrackDto } from "./track.dtos";
import { Album as AlbumEntity } from "./album.entity";
import { Artist } from "./artist.entity";

function parseAlbumId(value: string): string {
  const id = coerce.id(value);
  if (id === undefined) {
    throw new HttpError(400, "Invalid album id.");
  }
  return value;
}

const albumRef = entityRef(AlbumEntity);

type AlbumFilter = SimpleWhereInput<typeof AlbumEntity, "title" | "releaseYear" | "artistId">;
type OrmSession = ReturnType<typeof createSession>;

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
    throw new HttpError(404, "Album not found.");
  }
  return album;
}

async function getArtistOrThrow(session: OrmSession, id: number): Promise<Artist> {
  const artist = await session.find(Artist, id);
  if (!artist) {
    throw new HttpError(404, "Artist not found.");
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
      coerce.integer(ctx.query?.page, { min: 1, clamp: true }) ?? 1;
    const pageSize =
      coerce.integer(ctx.query?.pageSize, {
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
  async getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseInt(parseAlbumId(ctx.params.id), 10);
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
  async replace(ctx: RequestContext<ReplaceAlbumDto, undefined, { id: string }>) {
    const id = parseInt(parseAlbumId(ctx.params.id), 10);
    return withSession(async (session) => {
      const entity = await getAlbumOrThrow(session, id);
      await getArtistOrThrow(session, ctx.body.artistId);
      entity.title = ctx.body.title;
      entity.releaseYear = ctx.body.releaseYear ?? null;
      entity.artistId = ctx.body.artistId;
      await session.commit();
      return entity as AlbumDto;
    });
  }

  @Patch("/:id")
  @Params(AlbumParamsDto)
  @Body(UpdateAlbumDto)
  @Returns(AlbumDto)
  @AlbumErrors
  async update(ctx: RequestContext<UpdateAlbumDto, undefined, { id: string }>) {
    const id = parseInt(parseAlbumId(ctx.params.id), 10);
    return withSession(async (session) => {
      const entity = await getAlbumOrThrow(session, id);
      if (ctx.body.title !== undefined) {
        entity.title = ctx.body.title;
      }
      if (ctx.body.releaseYear !== undefined) {
        entity.releaseYear = ctx.body.releaseYear ?? null;
      }
      if (ctx.body.artistId !== undefined) {
        await getArtistOrThrow(session, ctx.body.artistId);
        entity.artistId = ctx.body.artistId;
      }
      await session.commit();
      return entity as AlbumDto;
    });
  }

  @Get("/:id/tracks")
  @Params(AlbumParamsDto)
  @Returns(t.array(t.ref(TrackDto)))
  @AlbumErrors
  async listTracks(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseInt(parseAlbumId(ctx.params.id), 10);
    return withSession(async (session) => {
      const album = await getAlbumOrThrow(session, id);
      return (await album.tracks.load()) as TrackDto[];
    });
  }

  @Post("/:id/tracks")
  @Params(AlbumParamsDto)
  @Body(CreateAlbumTrackDto)
  @Returns({ status: 201, schema: TrackDto })
  @AlbumErrors
  async createTrack(
    ctx: RequestContext<CreateAlbumTrackDto, undefined, { id: string }>
  ) {
    const id = parseInt(parseAlbumId(ctx.params.id), 10);
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
  async remove(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseInt(parseAlbumId(ctx.params.id), 10);
    return withSession(async (session) => {
      const album = await getAlbumOrThrow(session, id);
      await session.remove(album);
      await session.commit();
    });
  }
}
