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
  t,
  type RequestContext
} from "../../src";
import { applyFilter, toPagedResponse } from "metal-orm";
import type { SimpleWhereInput } from "metal-orm";
import { entityRef, selectFromEntity } from "metal-orm";
import { createSession } from "./db";
import {
  CreateArtistDto,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ReplaceArtistDto,
  UpdateArtistDto,
  AlbumDto,
  ArtistDto,
  ArtistErrors,
  ArtistParamsDto,
  ArtistPagedResponseDto,
  ArtistQueryDto
} from "./artist.dtos";
import { CreateArtistAlbumDto } from "./album.dtos";
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
  let result = value;
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
    throw new HttpError(400, "Invalid artist id.");
  }
  return id;
}

const artistRef = entityRef(Artist);

type ArtistFilter = SimpleWhereInput<typeof Artist, "name" | "genre">;
type OrmSession = ReturnType<typeof createSession>;

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
    throw new HttpError(404, "Artist not found.");
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
  @Query(ArtistQueryDto)
  @Returns(ArtistPagedResponseDto)
  async list(ctx: RequestContext<unknown, ArtistQueryDto>) {
    const page =
      parseInteger(ctx.query?.page, { min: 1, clamp: true }) ?? 1;
    const pageSize =
      parseInteger(ctx.query?.pageSize, {
        min: 1,
        max: MAX_PAGE_SIZE,
        clamp: true
      }) ?? DEFAULT_PAGE_SIZE;
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
  @Returns(t.array(t.ref(AlbumDto)))
  @ArtistErrors
  async listAlbums(ctx: RequestContext<unknown, undefined, ArtistParamsDto>) {
    const id = requireArtistId(ctx.params.id);
    return withSession(async (session) => {
      const artist = await getArtistOrThrow(session, id);
      return (await artist.albums.load()) as AlbumDto[];
    });
  }

  @Post("/:id/albums")
  @Params(ArtistParamsDto)
  @Body(CreateArtistAlbumDto)
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
