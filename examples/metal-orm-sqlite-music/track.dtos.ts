import {
  Errors,
  createMetalCrudDtoClasses,
  createMetalDtoOverrides,
  createPagedResponseDtoClass,
  createNestedCreateDtoClass,
  createPagedFilterQueryDtoClass,
  StandardErrorDto,
  t
} from "../../src";
import { Track } from "./track.entity";

const trackOverrides = createMetalDtoOverrides(Track, {
  overrides: {
    durationSeconds: t.nullable(t.integer({ minimum: 0 })),
    trackNumber: t.nullable(t.integer({ minimum: 1 }))
  }
});

const trackCrud = createMetalCrudDtoClasses(Track, {
  overrides: trackOverrides,
  response: { description: "Track returned by API." },
  mutationExclude: ["id", "createdAt"],
  immutable: ["albumId"]
});

export const {
  response: TrackDto,
  create: CreateTrackDto,
  replace: ReplaceTrackDto,
  update: UpdateTrackDto,
  params: TrackParamsDto
} = trackCrud;

export type TrackDto = Omit<Track, "album">;
type TrackMutationDto = Omit<TrackDto, "id" | "createdAt">;
type TrackUpdateDto = Omit<TrackMutationDto, "albumId">;
export type CreateTrackDto = TrackMutationDto;
export type ReplaceTrackDto = TrackUpdateDto;
export type UpdateTrackDto = Partial<TrackUpdateDto>;
export type TrackParamsDto = InstanceType<typeof TrackParamsDto>;

export const CreateAlbumTrackDtoClass = createNestedCreateDtoClass(
  Track,
  trackOverrides,
  {
    name: "CreateAlbumTrackDto",
    additionalExclude: ["albumId"]
  }
);

export interface CreateAlbumTrackDto {
  title: string;
  durationSeconds?: number | null;
  trackNumber?: number | null;
}

export const TrackQueryDtoClass = createPagedFilterQueryDtoClass({
  name: "TrackQueryDto",
  filters: {
    titleContains: { schema: t.string({ minLength: 1 }), operator: "contains" },
    albumId: { schema: t.integer({ minimum: 1 }), operator: "equals" }
  }
});

export interface TrackQueryDto {
  page?: number;
  pageSize?: number;
  titleContains?: string;
  albumId?: number;
}

export const TrackPagedResponseDto = createPagedResponseDtoClass({
  name: "TrackPagedResponseDto",
  itemDto: TrackDto,
  description: "Paged track list response."
});

export const TrackErrors = Errors(StandardErrorDto, [
  { status: 400, description: "Invalid track id." },
  { status: 404, description: "Track not found." }
]);
