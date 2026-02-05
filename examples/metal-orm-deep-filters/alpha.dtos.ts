import {
  Dto,
  Field,
  MergeDto,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  t
} from "../../src";

@Dto()
export class DeltaDto {
  @Field(t.integer({ minimum: 1 }))
  id!: number;

  @Field(t.string({ minLength: 1 }))
  name!: string;
}

@Dto()
export class CharlieDto {
  @Field(t.integer({ minimum: 1 }))
  id!: number;

  @Field(t.integer({ minimum: 0 }))
  score!: number;

  @Field(t.integer({ minimum: 1 }))
  bravoId!: number;

  @Field(t.optional(t.nullable(t.integer({ minimum: 1 }))))
  deltaId?: number | null;

  @Field(t.optional(t.nullable(t.ref(DeltaDto))))
  delta?: DeltaDto | null;
}

@Dto()
export class BravoDto {
  @Field(t.integer({ minimum: 1 }))
  id!: number;

  @Field(t.string({ minLength: 1 }))
  code!: string;

  @Field(t.integer({ minimum: 1 }))
  alphaId!: number;

  @Field(t.array(t.ref(CharlieDto)))
  charlies!: CharlieDto[];
}

@Dto()
export class AlphaDto {
  @Field(t.integer({ minimum: 1 }))
  id!: number;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.array(t.ref(BravoDto)))
  bravos!: BravoDto[];
}

const PagedQueryDto = createPagedQueryDtoClass({
  name: "AlphaPagedQueryDto"
});

@Dto()
class AlphaFilterQueryDto {
  @Field(t.optional(t.string({ minLength: 1 })))
  deltaNameContains?: string;

  @Field(t.optional(t.integer({ minimum: 0 })))
  charlieScoreGte?: number;

  @Field(t.optional(t.boolean()))
  deltaMissing?: boolean;
}

@MergeDto([PagedQueryDto, AlphaFilterQueryDto])
export class AlphaQueryDto {
  declare page?: number;
  declare pageSize?: number;
  declare deltaNameContains?: string;
  declare charlieScoreGte?: number;
  declare deltaMissing?: boolean;
}

export const AlphaPagedResponseDto = createPagedResponseDtoClass({
  itemDto: AlphaDto,
  name: "AlphaPagedResponseDto",
  description: "Paged alpha list with deep relations."
});
