import {
  Dto,
  MergeDto,
  Errors,
  createMetalCrudDtoClasses,
  createPagedResponseDtoClass,
  createPagedFilterQueryDtoClass,
  StandardErrorDto,
  t
} from "../../src";
import { Artist } from "./artist.entity";
import { AlbumDto, CreateArtistAlbumDto } from "./album.dtos";

const ARTIST_DTO_OVERRIDES = {
  id: t.integer({ description: "Artist id.", minimum: 1 }),
  name: t.string({ minLength: 1 }),
  genre: t.nullable(t.string()),
  country: t.nullable(t.string()),
  formedYear: t.nullable(t.integer({ minimum: 1000, maximum: 9999 })),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const artistCrud = createMetalCrudDtoClasses(Artist, {
  overrides: ARTIST_DTO_OVERRIDES,
  response: { description: "Artist returned by API." },
  mutationExclude: ["id", "createdAt"]
});

export const {
  response: ArtistDto,
  create: CreateArtistDto,
  replace: ReplaceArtistDto,
  update: UpdateArtistDto,
  params: ArtistParamsDto
} = artistCrud;

export type ArtistDto = Omit<Artist, "albums">;
type ArtistMutationDto = Omit<ArtistDto, "id" | "createdAt">;
export type CreateArtistDto = ArtistMutationDto;
export type ReplaceArtistDto = ArtistMutationDto;
export type UpdateArtistDto = Partial<ArtistMutationDto>;
export type ArtistParamsDto = InstanceType<typeof ArtistParamsDto>;

export const ArtistQueryDtoClass = createPagedFilterQueryDtoClass({
  name: "ArtistQueryDto",
  filters: {
    nameContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    genreContains: { schema: t.string({ minLength: 1 }), operator: "contains" }
  }
});

export interface ArtistQueryDto {
  page?: number;
  pageSize?: number;
  nameContains?: string;
  genreContains?: string;
}

export const ArtistPagedResponseDto = createPagedResponseDtoClass({
  name: "ArtistPagedResponseDto",
  itemDto: ArtistDto,
  description: "Paged artist list response."
});

export const ArtistErrors = Errors(StandardErrorDto, [
  { status: 400, description: "Invalid artist id." },
  { status: 404, description: "Artist not found." }
]);

export { AlbumDto, CreateArtistAlbumDto };
