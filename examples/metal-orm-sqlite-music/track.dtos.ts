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
  id: t.integer({ description: "Track id." }),
  title: t.string({ minLength: 1 }),
  durationSeconds: t.nullable(t.integer({ minimum: 0 })),
  trackNumber: t.nullable(t.integer({ minimum: 1 })),
  albumId: t.integer({ description: "Album id." }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const trackCrud = createMetalCrudDtos(Track, {
  overrides: TRACK_DTO_OVERRIDES,
  response: { description: "Track returned by the API." },
  mutationExclude: ["id", "createdAt"]
});

export interface TrackDto extends Omit<Track, "album"> {}

@trackCrud.response
export class TrackDto {}

type TrackMutationDto = Omit<TrackDto, "id" | "createdAt">;

export interface CreateTrackDto extends TrackMutationDto {}

@trackCrud.create
export class CreateTrackDto {}

export interface ReplaceTrackDto extends TrackMutationDto {}

@trackCrud.replace
export class ReplaceTrackDto {}

export interface UpdateTrackDto extends Partial<TrackMutationDto> {}

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

const PagedQueryDto = createPagedQueryDtoClass({
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

@MergeDto([PagedQueryDto, TrackFilterQueryDto])
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
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const TrackErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid track id." },
  { status: 404, description: "Track not found." }
]);
