import { describe, expect, it } from "vitest";
import {
  createMetalCrudDtos,
  createMetalCrudDtoClasses
} from "../../src/adapter/metal-orm/index";
import type { FilterMapping } from "../../src/adapter/metal-orm/index";
import { getDtoMeta } from "../../src/core/metadata";
import { t } from "../../src/core/schema";
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
    const pagedResponseMeta = getDtoMeta(classes.pagedResponseDto);
    const optionsMeta = getDtoMeta(classes.optionsDto);

    expect(classes.response.name).toBe("CrudDtoClassEntityDto");
    expect(classes.queryDto.name).toBe("CrudDtoClassEntityQueryDto");
    expect(classes.optionsQueryDto.name).toBe("CrudDtoClassEntityOptionsQueryDto");
    expect(classes.optionDto.name).toBe("CrudDtoClassEntityOptionDto");
    expect(pagedResponseMeta?.name).toBe("CrudDtoClassEntityPagedResponseDto");
    expect(optionsMeta?.name).toBe("CrudDtoClassEntityOptionsDto");
    expect(responseMeta?.fields.id).toBeDefined();
    expect(createMeta?.fields.id).toBeUndefined();
    expect(paramsMeta?.fields).toEqual({ id: expect.any(Object) });
    expect(classes.filterMappings).toEqual({
      search: {
        field: "nome",
        operator: "contains"
      }
    });
    expect(classes.sortableColumns).toEqual({});
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

  it("generates query/options artifacts and execution-ready metadata from one config", () => {
    const classes = createMetalCrudDtoClasses(CrudDtoClassEntity, {
      query: {
        filters: {
          nameContains: {
            schema: t.string({ minLength: 1 }),
            field: "name",
            operator: "contains"
          },
          nickname: {
            schema: t.string({ minLength: 1 }),
            field: "nickname"
          }
        },
        sortableColumns: {
          name: "name",
          nickname: "nickname"
        },
        options: {
          labelField: "name",
          searchKey: "labelContains"
        }
      },
      errors: true
    });

    const queryMeta = getDtoMeta(classes.queryDto);
    const optionsQueryMeta = getDtoMeta(classes.optionsQueryDto);
    const optionMeta = getDtoMeta(classes.optionDto);

    expect(queryMeta?.fields.page).toBeDefined();
    expect(queryMeta?.fields.pageSize).toBeDefined();
    expect(queryMeta?.fields.nameContains).toBeDefined();
    expect(queryMeta?.fields.nickname).toBeDefined();
    expect(queryMeta?.fields.sortBy).toBeDefined();
    expect(queryMeta?.fields.sortDirection).toBeDefined();

    expect(optionsQueryMeta?.fields.labelContains).toBeDefined();
    expect(optionMeta?.fields.id).toBeDefined();
    expect(optionMeta?.fields.name).toBeDefined();

    expect(classes.filterMappings).toEqual({
      nameContains: { field: "name", operator: "contains" },
      nickname: { field: "nickname", operator: "equals" },
      labelContains: { field: "name", operator: "contains" }
    });

    const typedMappings: Record<string, FilterMapping<CrudDtoClassEntity>> = classes.filterMappings;
    expect(typedMappings.nameContains.field).toBe("name");
    expect(classes.sortableColumns).toEqual({
      name: "name",
      nickname: "nickname"
    });
    expect(typeof classes.errors).toBe("function");
  });

  it("exposes listConfig with all query defaults ready for service layer", () => {
    const classes = createMetalCrudDtoClasses(CrudDtoClassEntity, {
      query: {
        filters: {
          nameContains: {
            schema: t.string({ minLength: 1 }),
            field: "name",
            operator: "contains"
          }
        },
        sortableColumns: {
          name: "name",
          nickname: "nickname"
        },
        defaultSortBy: "name",
        defaultSortDirection: "desc",
        defaultPageSize: 10,
        maxPageSize: 50
      }
    });

    expect(classes.listConfig).toEqual({
      filterMappings: classes.filterMappings,
      sortableColumns: { name: "name", nickname: "nickname" },
      defaultSortBy: "name",
      defaultSortDirection: "desc",
      defaultPageSize: 10,
      maxPageSize: 50,
      sortByKey: "sortBy",
      sortDirectionKey: "sortDirection"
    });
  });

  it("listConfig uses sensible defaults when query options are minimal", () => {
    const classes = createMetalCrudDtoClasses(CrudDtoClassEntity);

    expect(classes.listConfig).toEqual({
      filterMappings: classes.filterMappings,
      sortableColumns: {},
      defaultSortBy: undefined,
      defaultSortDirection: "asc",
      defaultPageSize: 25,
      maxPageSize: 100,
      sortByKey: "sortBy",
      sortDirectionKey: "sortDirection"
    });
  });
});
