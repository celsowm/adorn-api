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
import { Track } from "./track.entity";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const TRACK_DTO_OVERRIDES = {
  id: t.integer({ description: "Track id." }),
  title: t.string({ minLength: 1 }),
  durationSeconds: t.nullable(t.integer({ minimum: 0 })),
  trackNumber: t.nullable(t.integer({ minimum: 1 })),
  albumId: t.integer({ description: "Album id." }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

export interface TrackDto extends Omit<Track, "album"> {}

@MetalDto(Track, {
  description: "Track returned by the API.",
  overrides: TRACK_DTO_OVERRIDES
})
export class TrackDto {
  declare id: number;
  declare title: string;
  declare durationSeconds?: number | null;
  declare trackNumber?: number | null;
  declare albumId: number;
  declare createdAt: string;
}

const TRACK_MUTATION_KEYS: Array<keyof TrackDto> = ["id", "createdAt"];
type TrackMutationDto = Omit<TrackDto, (typeof TRACK_MUTATION_KEYS)[number]>;

export interface CreateTrackDto extends TrackMutationDto {}

@OmitDto(TrackDto, TRACK_MUTATION_KEYS)
export class CreateTrackDto {
  declare title: string;
  declare durationSeconds?: number | null;
  declare trackNumber?: number | null;
  declare albumId: number;
}

export interface ReplaceTrackDto extends TrackMutationDto {}

@OmitDto(TrackDto, TRACK_MUTATION_KEYS)
export class ReplaceTrackDto {
  declare title: string;
  declare durationSeconds?: number | null;
  declare trackNumber?: number | null;
  declare albumId: number;
}

export interface UpdateTrackDto extends Partial<TrackMutationDto> {}

@PartialDto(ReplaceTrackDto)
export class UpdateTrackDto {
  declare title?: string;
  declare durationSeconds?: number | null;
  declare trackNumber?: number | null;
  declare albumId?: number;
}

export interface TrackParamsDto extends Pick<TrackDto, "id"> {}

@PickDto(TrackDto, ["id"])
export class TrackParamsDto {
  declare id: number;
}

const ALBUM_TRACK_MUTATION_KEYS: Array<keyof TrackDto> = [
  ...TRACK_MUTATION_KEYS,
  "albumId"
];
type AlbumTrackMutationDto = Omit<TrackDto, (typeof ALBUM_TRACK_MUTATION_KEYS)[number]>;

export interface CreateAlbumTrackDto extends AlbumTrackMutationDto {}

@OmitDto(TrackDto, ALBUM_TRACK_MUTATION_KEYS)
export class CreateAlbumTrackDto {
  declare title: string;
  declare durationSeconds?: number | null;
  declare trackNumber?: number | null;
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
class TrackFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  titleContains?: string;

  @Field(t.optional(t.integer({ minimum: 1 })))
  albumId?: number;
}

@MergeDto([PagedQueryDto, TrackFilterQueryDto])
export class TrackQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare titleContains?: string;
  declare albumId?: number;
}

@Dto()
class TrackListItemsDto {
  @Field(t.array(t.ref(TrackDto)))
  items!: TrackDto[];
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

@MergeDto([TrackListItemsDto, PagedResponseMetaDto], {
  description: "Paged track list response."
})
export class TrackPagedResponseDto {}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const TrackErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid track id." },
  { status: 404, description: "Track not found." }
]);
