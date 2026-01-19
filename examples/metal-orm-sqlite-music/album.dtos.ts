import {
  Errors,
  createMetalCrudDtoClasses,
  createMetalDtoOverrides,
  createPagedResponseDtoClass,
  createNestedCreateDtoClass,
  createPagedFilterQueryDtoClass,
  StandardErrorDto,
  t
} from "../../src";
import { Album } from "./album.entity";
import { CreateAlbumTrackDto, CreateAlbumTrackDtoClass } from "./track.dtos";

const albumOverrides = createMetalDtoOverrides(Album, {
  overrides: {
    releaseYear: t.nullable(t.integer({ minimum: 1900, maximum: 9999 }))
  }
});

const albumCrud = createMetalCrudDtoClasses(Album, {
  overrides: albumOverrides,
  response: { description: "Album returned by API." },
  mutationExclude: ["id", "createdAt"],
  immutable: ["artistId"]
});

export const {
  response: AlbumDto,
  create: CreateAlbumDto,
  replace: ReplaceAlbumDto,
  update: UpdateAlbumDto,
  params: AlbumParamsDto
} = albumCrud;

export type AlbumDto = Omit<Album, "artist" | "tracks">;
type AlbumMutationDto = Omit<AlbumDto, "id" | "createdAt">;
type AlbumUpdateDto = Omit<AlbumMutationDto, "artistId">;
export type CreateAlbumDto = AlbumMutationDto;
export type ReplaceAlbumDto = AlbumUpdateDto;
export type UpdateAlbumDto = Partial<AlbumUpdateDto>;
export type AlbumParamsDto = InstanceType<typeof AlbumParamsDto>;

export const CreateArtistAlbumDtoClass = createNestedCreateDtoClass(
  Album,
  albumOverrides,
  {
    name: "CreateArtistAlbumDto",
    additionalExclude: ["artistId"]
  }
);

export interface CreateArtistAlbumDto {
  title: string;
  releaseYear?: number | null;
}

export const AlbumQueryDtoClass = createPagedFilterQueryDtoClass({
  name: "AlbumQueryDto",
  filters: {
    titleContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    releaseYear: { schema: t.integer({ minimum: 1900, maximum: 9999 }), operator: "equals" },
    artistId: { schema: t.integer({ minimum: 1 }), operator: "equals" }
  }
});

export interface AlbumQueryDto {
  page?: number;
  pageSize?: number;
  titleContains?: string;
  releaseYear?: number;
  artistId?: number;
}

export const AlbumPagedResponseDto = createPagedResponseDtoClass({
  name: "AlbumPagedResponseDto",
  itemDto: AlbumDto,
  description: "Paged album list response."
});

export const AlbumErrors = Errors(StandardErrorDto, [
  { status: 400, description: "Invalid album id." },
  { status: 404, description: "Album not found." }
]);

export { CreateAlbumTrackDto, CreateAlbumTrackDtoClass };
