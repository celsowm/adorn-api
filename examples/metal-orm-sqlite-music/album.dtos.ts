import {
  Dto,
  Errors,
  Field,
  MergeDto,
  MetalDto,
  createMetalCrudDtoClasses,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  t
} from "../../src";
import { Album } from "./album.entity";
import { CreateAlbumTrackDto } from "./track.dtos";

const ALBUM_DTO_OVERRIDES = {
  id: t.integer({ description: "Album id.", minimum: 1 }),
  title: t.string({ minLength: 1 }),
  releaseYear: t.nullable(t.integer({ minimum: 1900, maximum: 9999 })),
  artistId: t.integer({ description: "Artist id.", minimum: 1 }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const albumCrud = createMetalCrudDtoClasses(Album, {
  overrides: ALBUM_DTO_OVERRIDES,
  response: { description: "Album returned by the API." },
  mutationExclude: ["id", "createdAt"],
  replace: { exclude: ["artistId"] },
  update: { exclude: ["artistId"] }
});

export type AlbumDto = Omit<Album, "artist" | "tracks">;
type AlbumMutationDto = Omit<AlbumDto, "id" | "createdAt">;
type AlbumUpdateDto = Omit<AlbumMutationDto, "artistId">;
export type CreateAlbumDto = AlbumMutationDto;
export type ReplaceAlbumDto = AlbumUpdateDto;
export type UpdateAlbumDto = Partial<AlbumUpdateDto>;
export type AlbumParamsDto = Pick<AlbumDto, "id">;

export const {
  response: AlbumDto,
  create: CreateAlbumDto,
  replace: ReplaceAlbumDto,
  update: UpdateAlbumDto,
  params: AlbumParamsDto
} = albumCrud;

type ArtistAlbumMutationDto = Omit<AlbumDto, "id" | "createdAt" | "artistId">;

export interface CreateArtistAlbumDto extends ArtistAlbumMutationDto {}

@MetalDto(Album, {
  mode: "create",
  overrides: ALBUM_DTO_OVERRIDES,
  exclude: ["id", "createdAt", "artistId"]
})
export class CreateArtistAlbumDto {}

export const AlbumPagedQueryDto = createPagedQueryDtoClass({
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

@MergeDto([AlbumPagedQueryDto, AlbumFilterQueryDto])
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
class ErrorDetailDto {
  @Field(t.string())
  field!: string;

  @Field(t.string())
  message!: string;
}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;

  @Field(t.optional(t.string()))
  code?: string;

  @Field(t.optional(t.array(t.ref(ErrorDetailDto))))
  errors?: ErrorDetailDto[];

  @Field(t.optional(t.string()))
  traceId?: string;
}

export const AlbumErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid album id." },
  { status: 404, description: "Album not found." }
]);

export { CreateAlbumTrackDto };
