import {
  Dto,
  Errors,
  Field,
  MergeDto,
  createMetalCrudDtos,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  t
} from "../../src";
import { Artist } from "./artist.entity";
import { AlbumDto, CreateArtistAlbumDto } from "./album.dtos";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const ARTIST_DTO_OVERRIDES = {
  id: t.integer({ description: "Artist id." }),
  name: t.string({ minLength: 1 }),
  genre: t.nullable(t.string()),
  country: t.nullable(t.string()),
  formedYear: t.nullable(t.integer({ minimum: 1000, maximum: 9999 })),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const artistCrud = createMetalCrudDtos(Artist, {
  overrides: ARTIST_DTO_OVERRIDES,
  response: { description: "Artist returned by the API." },
  mutationExclude: ["id", "createdAt"]
});

export interface ArtistDto extends Omit<Artist, "albums"> {}

@artistCrud.response
export class ArtistDto {}

type ArtistMutationDto = Omit<ArtistDto, "id" | "createdAt">;

export interface CreateArtistDto extends ArtistMutationDto {}

@artistCrud.create
export class CreateArtistDto {}

export interface ReplaceArtistDto extends ArtistMutationDto {}

@artistCrud.replace
export class ReplaceArtistDto {}

export interface UpdateArtistDto extends Partial<ArtistMutationDto> {}

@artistCrud.update
export class UpdateArtistDto {}

export interface ArtistParamsDto extends Pick<ArtistDto, "id"> {}

@artistCrud.params
export class ArtistParamsDto {}

const PagedQueryDto = createPagedQueryDtoClass({
  defaultPageSize: DEFAULT_PAGE_SIZE,
  maxPageSize: MAX_PAGE_SIZE,
  name: "ArtistPagedQueryDto"
});

@Dto()
class ArtistFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  nameContains?: string;

  @Field(t.optional(t.string({ minLength: 1 })))
  genreContains?: string;
}

@MergeDto([PagedQueryDto, ArtistFilterQueryDto])
export class ArtistQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare nameContains?: string;
  declare genreContains?: string;
}

export const ArtistPagedResponseDto = createPagedResponseDtoClass({
  name: "ArtistPagedResponseDto",
  itemDto: ArtistDto,
  description: "Paged artist list response."
});

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const ArtistErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid artist id." },
  { status: 404, description: "Artist not found." }
]);

export { AlbumDto, CreateArtistAlbumDto };
