import { describe, expect, it } from "vitest";
import {
  createMetalCrudDtos,
  createMetalCrudDtoClasses
} from "../../src/adapter/metal-orm/index";
import { getDtoMeta } from "../../src/core/metadata";
import { Alphanumeric, Column, Email, Entity, Length, Pattern, PrimaryKey, col } from "metal-orm";

describe("createMetalCrudDtos", () => {
  @Entity({ tableName: "crud_dto_entities" })
  class CrudDtoEntity {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.notNull(col.text()))
    name!: string;

    @Column(col.text())
    nickname?: string | null;
  }

  it("creates CRUD DTO decorators with defaults", () => {
    const crud = createMetalCrudDtos(CrudDtoEntity, {
      mutationExclude: ["id"]
    });

    @crud.response
    class CrudDto {}

    @crud.create
    class CreateCrudDto {}

    @crud.update
    class UpdateCrudDto {}

    @crud.params
    class CrudParamsDto {}

    const responseMeta = getDtoMeta(CrudDto);
    const createMeta = getDtoMeta(CreateCrudDto);
    const updateMeta = getDtoMeta(UpdateCrudDto);
    const paramsMeta = getDtoMeta(CrudParamsDto);

    expect(responseMeta?.fields.id).toBeDefined();
    expect(createMeta?.fields.id).toBeUndefined();
    expect(updateMeta?.fields.name?.optional).toBe(true);
    expect(Object.keys(paramsMeta?.fields ?? {})).toEqual(["id"]);
  });

  @Entity({ tableName: "transformer_entities" })
  class TransformerEntity {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.varchar(50))
    @Length({ min: 2, max: 10 })
    name!: string;

    @Column(col.text())
    @Pattern({ pattern: /^[A-Z]+$/ })
    code!: string;

    @Column(col.text())
    @Email()
    email!: string;

    @Column(col.text())
    @Alphanumeric({ allowHyphens: true })
    slug!: string;
  }

  it("maps transformer validators into string schemas", () => {
    const crud = createMetalCrudDtos(TransformerEntity);

    @crud.create
    class CreateTransformerDto {}

    const meta = getDtoMeta(CreateTransformerDto);
    expect((meta?.fields.email?.schema as any).format).toBe("email");
    expect((meta?.fields.name?.schema as any).minLength).toBe(2);
    expect((meta?.fields.name?.schema as any).maxLength).toBe(10);
    expect((meta?.fields.code?.schema as any).pattern).toBe("^[A-Z]+$");
    expect((meta?.fields.slug?.schema as any).pattern).toBe("^[a-zA-Z0-9-]*$");
  });
});

describe("createMetalCrudDtoClasses", () => {
  @Entity({ tableName: "crud_dto_class_entities" })
  class CrudDtoClassEntity {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.notNull(col.text()))
    name!: string;

    @Column(col.text())
    nickname?: string | null;
  }

  it("builds ready-to-export DTO classes", () => {
    const classes = createMetalCrudDtoClasses(CrudDtoClassEntity, {
      mutationExclude: ["id"]
    });

    const responseMeta = getDtoMeta(classes.response);
    const createMeta = getDtoMeta(classes.create);
    const paramsMeta = getDtoMeta(classes.params);

    expect(classes.response.name).toBe("CrudDtoClassEntityDto");
    expect(responseMeta?.fields.id).toBeDefined();
    expect(createMeta?.fields.id).toBeUndefined();
    expect(paramsMeta?.fields).toEqual({ id: expect.any(Object) });
  });

  it("applies custom name overrides", () => {
    const classes = createMetalCrudDtoClasses(CrudDtoClassEntity, {
      baseName: "Person",
      names: {
        response: "PersonDto",
        params: "PersonIdDto"
      }
    });

    expect(classes.response.name).toBe("PersonDto");
    expect(classes.params.name).toBe("PersonIdDto");
    expect(classes.create.name).toBe("CreatePersonDto");
  });
});
