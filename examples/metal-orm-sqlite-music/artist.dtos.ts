import {
  Dto,
  Errors,
  Field,
  MergeDto,
  MetalDto,
  OmitDto,
  PartialDto,
  PickDto,
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

export interface ArtistDto extends Omit<Artist, "albums"> {}

@MetalDto(Artist, {
  description: "Artist returned by the API.",
  overrides: ARTIST_DTO_OVERRIDES
})
export class ArtistDto {
  declare id: number;
  declare name: string;
  declare genre?: string | null;
  declare country?: string | null;
  declare formedYear?: number | null;
  declare createdAt: string;
}

const ARTIST_MUTATION_KEYS: Array<keyof ArtistDto> = ["id", "createdAt"];
type ArtistMutationDto = Omit<ArtistDto, (typeof ARTIST_MUTATION_KEYS)[number]>;

export interface CreateArtistDto extends ArtistMutationDto {}

@OmitDto(ArtistDto, ARTIST_MUTATION_KEYS)
export class CreateArtistDto {
  declare name: string;
  declare genre?: string | null;
  declare country?: string | null;
  declare formedYear?: number | null;
}

export interface ReplaceArtistDto extends ArtistMutationDto {}

@OmitDto(ArtistDto, ARTIST_MUTATION_KEYS)
export class ReplaceArtistDto {
  declare name: string;
  declare genre?: string | null;
  declare country?: string | null;
  declare formedYear?: number | null;
}

export interface UpdateArtistDto extends Partial<ArtistMutationDto> {}

@PartialDto(ReplaceArtistDto)
export class UpdateArtistDto {
  declare name?: string;
  declare genre?: string | null;
  declare country?: string | null;
  declare formedYear?: number | null;
}

export interface ArtistParamsDto extends Pick<ArtistDto, "id"> {}

@PickDto(ArtistDto, ["id"])
export class ArtistParamsDto {
  declare id: number;
}

@Dto()
class PagedQueryDto {
  @Field(t.optional(t.integer({ minimum: 1, default: 1 })))
  page?: number;

  @Field(
    t.optional(
      t.integer({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
    )
  )
  pageSize?: number;
}

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

@Dto()
class ArtistListItemsDto {
  @Field(t.array(t.ref(ArtistDto)))
  items!: ArtistDto[];
}

@Dto()
class PagedResponseMetaDto {
  @Field(t.integer({ minimum: 0 }))
  totalItems!: number;

  @Field(t.integer({ minimum: 1 }))
  page!: number;

  @Field(t.integer({ minimum: 1 }))
  pageSize!: number;

  @Field(t.integer({ minimum: 1 }))
  totalPages!: number;

  @Field(t.boolean())
  hasNextPage!: boolean;

  @Field(t.boolean())
  hasPrevPage!: boolean;
}

@MergeDto([ArtistListItemsDto, PagedResponseMetaDto], {
  description: "Paged artist list response."
})
export class ArtistPagedResponseDto {}

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
