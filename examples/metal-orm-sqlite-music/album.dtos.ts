import {
  Dto,
  MergeDto,
  Errors,
  createMetalCrudDtoClasses,
  createPagedResponseDtoClass,
  createNestedCreateDtoClass,
  createPagedFilterQueryDtoClass,
  StandardErrorDto,
  t
} from "../../src";
import { Album } from "./album.entity";
import { CreateAlbumTrackDto, CreateAlbumTrackDtoClass } from "./track.dtos";

const ALBUM_DTO_OVERRIDES = {
  id: t.integer({ description: "Album id.", minimum: 1 }),
  title: t.string({ minLength: 1 }),
  releaseYear: t.nullable(t.integer({ minimum: 1900, maximum: 9999 })),
  artistId: t.integer({ description: "Artist id.", minimum: 1 }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const albumCrud = createMetalCrudDtoClasses(Album, {
  overrides: ALBUM_DTO_OVERRIDES,
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
  ALBUM_DTO_OVERRIDES,
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
