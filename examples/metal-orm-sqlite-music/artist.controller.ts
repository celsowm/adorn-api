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
  CreateArtistDto,
  ReplaceArtistDto,
  UpdateArtistDto,
  AlbumDto,
  ArtistDto,
  ArtistErrors,
  ArtistParamsDto,
  ArtistPagedResponseDto,
  ArtistQueryDto,
  ArtistQueryDtoClass
} from "./artist.dtos";
import {
  CreateArtistAlbumDto,
  CreateArtistAlbumDtoClass,
  AlbumQueryDto,
  AlbumQueryDtoClass,
  AlbumPagedResponseDto
} from "./album.dtos";
import { Album as AlbumEntity } from "./album.entity";
import { Artist } from "./artist.entity";

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

function requireArtistId(value: unknown): number {
  const id = parseInteger(value, { min: 1 });
  if (id === undefined) {
    const message = "Invalid artist id.";
    throw new HttpError(
      400,
      message,
      buildErrorBody(message, "INVALID_ARTIST_ID", [{ field: "id", message }])
    );
  }
  return id;
}

const artistRef = entityRef(Artist);
const albumRef = entityRef(AlbumEntity);

type ArtistFilter = SimpleWhereInput<typeof Artist, "name" | "genre">;
type ArtistAlbumFilter = SimpleWhereInput<typeof AlbumEntity, "artistId">;
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

async function getArtistOrThrow(session: OrmSession, id: number): Promise<Artist> {
  const artist = await session.find(Artist, id);
  if (!artist) {
    const message = "Artist not found.";
    throw new HttpError(404, message, buildErrorBody(message, "ARTIST_NOT_FOUND"));
  }
  return artist;
}

function buildArtistFilter(query?: ArtistQueryDto): ArtistFilter | undefined {
  if (!query) {
    return undefined;
  }
  const filter: ArtistFilter = {};
  if (query.nameContains) {
    filter.name = { contains: query.nameContains };
  }
  if (query.genreContains) {
    filter.genre = { contains: query.genreContains };
  }
  return Object.keys(filter).length ? filter : undefined;
}

@Controller("/artists")
export class ArtistController {
  @Get("/")
  @Query(ArtistQueryDtoClass)
  @Returns(ArtistPagedResponseDto)
  async list(ctx: RequestContext<unknown, ArtistQueryDto>) {
    const paginationQuery = (ctx.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = parsePagination(paginationQuery);
    return withSession(async (session) => {
      const filters = buildArtistFilter(ctx.query);
      const query = applyFilter(
        selectFromEntity(Artist).orderBy(artistRef.id, "ASC"),
        Artist,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Get("/:id")
  @Params(ArtistParamsDto)
  @Returns(ArtistDto)
  @ArtistErrors
  async getOne(ctx: RequestContext<unknown, undefined, ArtistParamsDto>) {
    const id = requireArtistId(ctx.params.id);
    return withSession(async (session) => {
      const artist = await getArtistOrThrow(session, id);
      return artist as ArtistDto;
    });
  }

  @Post("/")
  @Body(CreateArtistDto)
  @Returns({ status: 201, schema: ArtistDto })
  async create(ctx: RequestContext<CreateArtistDto>) {
    return withSession(async (session) => {
      const artist = new Artist();
      artist.name = ctx.body.name;
      artist.genre = ctx.body.genre ?? null;
      artist.country = ctx.body.country ?? null;
      artist.formedYear = ctx.body.formedYear ?? null;
      artist.createdAt = new Date().toISOString();
      await session.persist(artist);
      await session.commit();
      return artist as ArtistDto;
    });
  }

  @Put("/:id")
  @Params(ArtistParamsDto)
  @Body(ReplaceArtistDto)
  @Returns(ArtistDto)
  @ArtistErrors
  async replace(ctx: RequestContext<ReplaceArtistDto, undefined, ArtistParamsDto>) {
    const id = requireArtistId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getArtistOrThrow(session, id);
      entity.name = ctx.body.name;
      entity.genre = ctx.body.genre ?? null;
      entity.country = ctx.body.country ?? null;
      entity.formedYear = ctx.body.formedYear ?? null;
      await session.commit();
      return entity as ArtistDto;
    });
  }

  @Patch("/:id")
  @Params(ArtistParamsDto)
  @Body(UpdateArtistDto)
  @Returns(ArtistDto)
  @ArtistErrors
  async update(ctx: RequestContext<UpdateArtistDto, undefined, ArtistParamsDto>) {
    const id = requireArtistId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getArtistOrThrow(session, id);
      if (ctx.body.name !== undefined) {
        entity.name = ctx.body.name;
      }
      if (ctx.body.genre !== undefined) {
        entity.genre = ctx.body.genre ?? null;
      }
      if (ctx.body.country !== undefined) {
        entity.country = ctx.body.country ?? null;
      }
      if (ctx.body.formedYear !== undefined) {
        entity.formedYear = ctx.body.formedYear ?? null;
      }
      await session.commit();
      return entity as ArtistDto;
    });
  }

  @Get("/:id/albums")
  @Params(ArtistParamsDto)
  @Query(AlbumQueryDtoClass)
  @Returns(AlbumPagedResponseDto)
  @ArtistErrors
  async listAlbums(
    ctx: RequestContext<unknown, AlbumQueryDto, ArtistParamsDto>
  ) {
    const id = requireArtistId(ctx.params.id);
    const paginationQuery = (ctx.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = parsePagination(paginationQuery);
    return withSession(async (session) => {
      await getArtistOrThrow(session, id);
      const filters: ArtistAlbumFilter = {
        artistId: { equals: id }
      };
      const query = applyFilter(
        selectFromEntity(AlbumEntity).orderBy(albumRef.id, "ASC"),
        AlbumEntity,
        filters
      );
      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }

  @Post("/:id/albums")
  @Params(ArtistParamsDto)
  @Body(CreateArtistAlbumDtoClass)
  @Returns({ status: 201, schema: AlbumDto })
  @ArtistErrors
  async createAlbum(
    ctx: RequestContext<CreateArtistAlbumDto, undefined, ArtistParamsDto>
  ) {
    const id = requireArtistId(ctx.params.id);
    return withSession(async (session) => {
      const artist = await getArtistOrThrow(session, id);
      const album = artist.albums.add({
        title: ctx.body.title,
        releaseYear: ctx.body.releaseYear ?? null,
        createdAt: new Date().toISOString()
      });
      await session.commit();
      return album as AlbumDto;
    });
  }

  @Delete("/:id")
  @Params(ArtistParamsDto)
  @Returns({ status: 204 })
  @ArtistErrors
  async remove(ctx: RequestContext<unknown, undefined, ArtistParamsDto>) {
    const id = requireArtistId(ctx.params.id);
    return withSession(async (session) => {
      const artist = await getArtistOrThrow(session, id);
      await session.remove(artist);
      await session.commit();
    });
  }
}
