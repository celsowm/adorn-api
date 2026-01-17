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

export interface AlbumDto extends Omit<Album, "artist" | "tracks"> {}

@MetalDto(Album, {
  description: "Album returned by the API.",
  overrides: ALBUM_DTO_OVERRIDES
})
export class AlbumDto {
  declare id: number;
  declare title: string;
  declare releaseYear?: number | null;
  declare artistId: number;
  declare createdAt: string;
}

const ALBUM_MUTATION_KEYS: Array<keyof AlbumDto> = ["id", "createdAt"];
type AlbumMutationDto = Omit<AlbumDto, (typeof ALBUM_MUTATION_KEYS)[number]>;

export interface CreateAlbumDto extends AlbumMutationDto {}

@OmitDto(AlbumDto, ALBUM_MUTATION_KEYS)
export class CreateAlbumDto {
  declare title: string;
  declare releaseYear?: number | null;
  declare artistId: number;
}

export interface ReplaceAlbumDto extends AlbumMutationDto {}

@OmitDto(AlbumDto, ALBUM_MUTATION_KEYS)
export class ReplaceAlbumDto {
  declare title: string;
  declare releaseYear?: number | null;
  declare artistId: number;
}

export interface UpdateAlbumDto extends Partial<AlbumMutationDto> {}

@PartialDto(ReplaceAlbumDto)
export class UpdateAlbumDto {
  declare title?: string;
  declare releaseYear?: number | null;
  declare artistId?: number;
}

export interface AlbumParamsDto extends Pick<AlbumDto, "id"> {}

@PickDto(AlbumDto, ["id"])
export class AlbumParamsDto {
  declare id: number;
}

const ARTIST_ALBUM_MUTATION_KEYS: Array<keyof AlbumDto> = [
  ...ALBUM_MUTATION_KEYS,
  "artistId"
];
type ArtistAlbumMutationDto = Omit<AlbumDto, (typeof ARTIST_ALBUM_MUTATION_KEYS)[number]>;

export interface CreateArtistAlbumDto extends ArtistAlbumMutationDto {}

@OmitDto(AlbumDto, ARTIST_ALBUM_MUTATION_KEYS)
export class CreateArtistAlbumDto {
  declare title: string;
  declare releaseYear?: number | null;
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

@Dto()
class AlbumListItemsDto {
  @Field(t.array(t.ref(AlbumDto)))
  items!: AlbumDto[];
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

@MergeDto([AlbumListItemsDto, PagedResponseMetaDto], {
  description: "Paged album list response."
})
export class AlbumPagedResponseDto {}

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
