import {
  Dto,
  Errors,
  Field,
  MergeDto,
  MetalDto,
  createMetalCrudDtos,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  t
} from "../../src";
import { Album } from "./album.entity";
import { CreateAlbumTrackDto } from "./track.dtos";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const ALBUM_DTO_OVERRIDES = {
  id: t.integer({ description: "Album id." }),
  title: t.string({ minLength: 1 }),
  releaseYear: t.nullable(t.integer({ minimum: 1900, maximum: 9999 })),
  artistId: t.integer({ description: "Artist id." }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const albumCrud = createMetalCrudDtos(Album, {
  overrides: ALBUM_DTO_OVERRIDES,
  response: { description: "Album returned by the API." },
  mutationExclude: ["id", "createdAt"]
});

export interface AlbumDto extends Omit<Album, "artist" | "tracks"> {}

@albumCrud.response
export class AlbumDto {}

type AlbumMutationDto = Omit<AlbumDto, "id" | "createdAt">;

export interface CreateAlbumDto extends AlbumMutationDto {}

@albumCrud.create
export class CreateAlbumDto {}

export interface ReplaceAlbumDto extends AlbumMutationDto {}

@albumCrud.replace
export class ReplaceAlbumDto {}

export interface UpdateAlbumDto extends Partial<AlbumMutationDto> {}

@albumCrud.update
export class UpdateAlbumDto {}

export interface AlbumParamsDto extends Pick<AlbumDto, "id"> {}

@albumCrud.params
export class AlbumParamsDto {}

type ArtistAlbumMutationDto = Omit<AlbumDto, "id" | "createdAt" | "artistId">;

export interface CreateArtistAlbumDto extends ArtistAlbumMutationDto {}

@MetalDto(Album, {
  mode: "create",
  overrides: ALBUM_DTO_OVERRIDES,
  exclude: ["id", "createdAt", "artistId"]
})
export class CreateArtistAlbumDto {}

const PagedQueryDto = createPagedQueryDtoClass({
  defaultPageSize: DEFAULT_PAGE_SIZE,
  maxPageSize: MAX_PAGE_SIZE,
  name: "AlbumPagedQueryDto"
});

@Dto()
class AlbumFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  titleContains?: string;

  @Field(t.optional(t.integer({ minimum: 1900, maximum: 9999 })))
  releaseYear?: number;

  @Field(t.optional(t.integer({ minimum: 1 })))
  artistId?: number;
}

@MergeDto([PagedQueryDto, AlbumFilterQueryDto])
export class AlbumQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare titleContains?: string;
  declare releaseYear?: number;
  declare artistId?: number;
}

export const AlbumPagedResponseDto = createPagedResponseDtoClass({
  name: "AlbumPagedResponseDto",
  itemDto: AlbumDto,
  description: "Paged album list response."
});

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const AlbumErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid album id." },
  { status: 404, description: "Album not found." }
]);

export { CreateAlbumTrackDto };
