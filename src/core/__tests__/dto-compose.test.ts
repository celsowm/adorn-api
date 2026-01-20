import { describe, expect, it } from "vitest";
import { Dto, Field, MergeDto, OmitDto, PartialDto, PickDto } from "../decorators";
import { getDtoMeta } from "../metadata";
import { t } from "../schema";

@Dto()
class BaseDto {
  @Field(t.integer())
  id!: number;

  @Field(t.string({ minLength: 1 }))
  name!: string;

  @Field(t.optional(t.boolean()))
  active?: boolean;
}

@PickDto(BaseDto, ["id", "name"])
class PickedDto {}

@OmitDto(BaseDto, ["id"], {
  overrides: {
    active: { optional: false }
  }
})
class OmittedDto {}

@PartialDto(OmittedDto)
class PartialOmittedDto {}

@Dto()
class AuditDto {
  @Field(t.string({ minLength: 3 }))
  name!: string;

  @Field(t.string())
  updatedBy!: string;
}

@MergeDto([PickedDto, AuditDto])
class MergedDto {}

describe("dto composition decorators", () => {
  it("picks and omits fields", () => {
    const pickMeta = getDtoMeta(PickedDto);
    expect(pickMeta).toBeTruthy();
    expect(Object.keys(pickMeta!.fields)).toEqual(["id", "name"]);

    const omitMeta = getDtoMeta(OmittedDto);
    expect(omitMeta).toBeTruthy();
    expect(Object.keys(omitMeta!.fields)).toEqual(["name", "active"]);
    expect(omitMeta!.fields.active.optional).toBe(false);
  });

  it("marks partial DTOs as optional", () => {
    const meta = getDtoMeta(PartialOmittedDto);
    expect(meta).toBeTruthy();
    expect(meta!.fields.name.optional).toBe(true);
    expect(meta!.fields.active.optional).toBe(true);
  });

  it("merges DTO fields with later overrides", () => {
    const meta = getDtoMeta(MergedDto);
    expect(meta).toBeTruthy();
    expect(Object.keys(meta!.fields)).toEqual(["id", "name", "updatedBy"]);
    expect((meta!.fields.name.schema as { minLength?: number }).minLength).toBe(3);
  });
});
