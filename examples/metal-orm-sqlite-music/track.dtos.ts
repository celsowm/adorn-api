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
import { Track } from "./track.entity";

const TRACK_DTO_OVERRIDES = {
  id: t.integer({ description: "Track id.", minimum: 1 }),
  title: t.string({ minLength: 1 }),
  durationSeconds: t.nullable(t.integer({ minimum: 0 })),
  trackNumber: t.nullable(t.integer({ minimum: 1 })),
  albumId: t.integer({ description: "Album id.", minimum: 1 }),
  createdAt: t.dateTime({ description: "Creation timestamp." })
};

const trackCrud = createMetalCrudDtoClasses(Track, {
  overrides: TRACK_DTO_OVERRIDES,
  response: { description: "Track returned by the API." },
  mutationExclude: ["id", "createdAt"],
  immutable: ["albumId"]
});

export type TrackDto = Omit<Track, "album">;
type TrackMutationDto = Omit<TrackDto, "id" | "createdAt">;
type TrackUpdateDto = Omit<TrackMutationDto, "albumId">;
export type CreateTrackDto = TrackMutationDto;
export type ReplaceTrackDto = TrackUpdateDto;
export type UpdateTrackDto = Partial<TrackUpdateDto>;
export type TrackParamsDto = Pick<TrackDto, "id">;

export const {
  response: TrackDto,
  create: CreateTrackDto,
  replace: ReplaceTrackDto,
  update: UpdateTrackDto,
  params: TrackParamsDto
} = trackCrud;

export const CreateAlbumTrackDto = createNestedCreateDtoClass(
  Track,
  TRACK_DTO_OVERRIDES,
  {
    name: "CreateAlbumTrackDto",
    additionalExclude: ["albumId"]
  }
);

export const TrackQueryDto = createPagedFilterQueryDtoClass({
  name: "TrackQueryDto",
  filters: {
    titleContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    albumId: { schema: t.integer({ minimum: 1 }), operator: "equals" }
  }
});

export const TrackPagedResponseDto = createPagedResponseDtoClass({
  name: "TrackPagedResponseDto",
  itemDto: TrackDto,
  description: "Paged track list response."
});

export const TrackErrors = Errors(StandardErrorDto, [
  { status: 400, description: "Invalid track id." },
  { status: 404, description: "Track not found." }
]);

export type CreateAlbumTrackDto = typeof CreateAlbumTrackDto;
export type TrackQueryDto = typeof TrackQueryDto;
