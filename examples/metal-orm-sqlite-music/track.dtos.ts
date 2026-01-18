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
import { Track } from "./track.entity";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

const TRACK_DTO_OVERRIDES = {
  id: t.integer({ description: "Track id.", minimum: 1 }),
  title: t.string({ minLength: 1 }),
  durationSeconds: t.nullable(t.integer({ minimum: 0 })),
  trackNumber: t.nullable(t.integer({ minimum: 1 })),
  albumId: t.integer({ description: "Album id.", minimum: 1 }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const trackCrud = createMetalCrudDtos(Track, {
  overrides: TRACK_DTO_OVERRIDES,
  response: { description: "Track returned by the API." },
  mutationExclude: ["id", "createdAt"],
  replace: { exclude: ["albumId"] },
  update: { exclude: ["albumId"] }
});

export interface TrackDto extends Omit<Track, "album"> {}

@trackCrud.response
export class TrackDto {}

type TrackMutationDto = Omit<TrackDto, "id" | "createdAt">;
type TrackUpdateDto = Omit<TrackMutationDto, "albumId">;

export interface CreateTrackDto extends TrackMutationDto {}

@trackCrud.create
export class CreateTrackDto {}

export interface ReplaceTrackDto extends TrackUpdateDto {}

@trackCrud.replace
export class ReplaceTrackDto {}

export interface UpdateTrackDto extends Partial<TrackUpdateDto> {}

@trackCrud.update
export class UpdateTrackDto {}

export interface TrackParamsDto extends Pick<TrackDto, "id"> {}

@trackCrud.params
export class TrackParamsDto {}

type AlbumTrackMutationDto = Omit<TrackDto, "id" | "createdAt" | "albumId">;

export interface CreateAlbumTrackDto extends AlbumTrackMutationDto {}

@MetalDto(Track, {
  mode: "create",
  overrides: TRACK_DTO_OVERRIDES,
  exclude: ["id", "createdAt", "albumId"]
})
export class CreateAlbumTrackDto {}

export const TrackPagedQueryDto = createPagedQueryDtoClass({
  defaultPageSize: DEFAULT_PAGE_SIZE,
  maxPageSize: MAX_PAGE_SIZE,
  name: "TrackPagedQueryDto"
});

@Dto()
class TrackFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  titleContains?: string;

  @Field(t.optional(t.integer({ minimum: 1 })))
  albumId?: number;
}

@MergeDto([TrackPagedQueryDto, TrackFilterQueryDto])
export class TrackQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare titleContains?: string;
  declare albumId?: number;
}

export const TrackPagedResponseDto = createPagedResponseDtoClass({
  name: "TrackPagedResponseDto",
  itemDto: TrackDto,
  description: "Paged track list response."
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

export const TrackErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid track id." },
  { status: 404, description: "Track not found." }
]);
