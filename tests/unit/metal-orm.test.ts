import { describe, expect, it } from "vitest";
import {
  parsePagination,
  parseIdOrThrow,
  parseFilter,
  createFilterMappings,
  withSession,
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  createMetalCrudDtos,
  createMetalCrudDtoClasses,
  createMetalDtoOverrides
} from "../../src/adapter/metal-orm/index";
import { HttpError } from "../../src/core/errors";
import { Column, Entity, PrimaryKey, col } from "metal-orm";
import { getDtoMeta } from "../../src/core/metadata";

describe("metal-orm helpers", () => {
  describe("parsePagination", () => {
    it("uses defaults when no query provided", () => {
      const result = parsePagination({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
    });

    it("applies custom defaults", () => {
      const result = parsePagination({}, { defaultPageSize: 50, maxPageSize: 200 });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it("parses page and pageSize from query", () => {
      const result = parsePagination({ page: "2", pageSize: "10" });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it("clamps pageSize to max", () => {
      const result = parsePagination({ pageSize: "150" }, { maxPageSize: 100 });
      expect(result.pageSize).toBe(100);
    });

    it("clamps page to min of 1", () => {
      const result = parsePagination({ page: "0" });
      expect(result.page).toBe(1);
    });

    it("handles invalid values as defaults", () => {
      const result = parsePagination({ page: "invalid", pageSize: "not-a-number" });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
    });
  });

  describe("parseIdOrThrow", () => {
    it("parses valid ID", () => {
      const result = parseIdOrThrow("123", "User");
      expect(result).toBe(123);
    });

    it("parses number ID", () => {
      const result = parseIdOrThrow(456, "Post");
      expect(result).toBe(456);
    });

    it("throws error for invalid ID", () => {
      expect(() => parseIdOrThrow("invalid", "User")).toThrow(HttpError);
      expect(() => parseIdOrThrow("invalid", "User")).toThrow("Invalid User id.");
    });

    it("throws error for negative ID", () => {
      expect(() => parseIdOrThrow("-1", "User")).toThrow(HttpError);
    });

    it("throws error for zero ID", () => {
      expect(() => parseIdOrThrow("0", "User")).toThrow(HttpError);
    });
  });

  describe("parseFilter", () => {
    it("returns undefined when query is undefined", () => {
      const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
      const result = parseFilter<{ name: string }, "name">(undefined, mappings);
      expect(result).toBeUndefined();
    });

    it("returns undefined when no matching query keys", () => {
      const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
      const result = parseFilter<{ name: string }, "name">({ unknown: "value" }, mappings);
      expect(result).toBeUndefined();
    });

    it("builds filter with contains operator", () => {
      const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
      const result = parseFilter<{ name: string }, "name">({ nameContains: "John" }, mappings);
      expect(result).toEqual({ name: { contains: "John" } });
    });

    it("builds filter with equals operator", () => {
      const mappings = { userId: { field: "userId" as const, operator: "equals" as const } };
      const result = parseFilter<{ userId: number }, "userId">({ userId: 123 }, mappings);
      expect(result).toEqual({ userId: { equals: 123 } });
    });

    it("builds filter with multiple fields", () => {
      const mappings = {
        nameContains: { field: "name" as const, operator: "contains" as const },
        userId: { field: "userId" as const, operator: "equals" as const }
      };
      const result = parseFilter<{ name: string; userId: number }, "name" | "userId">(
        { nameContains: "John", userId: 123 },
        mappings
      );
      expect(result).toEqual({ name: { contains: "John" }, userId: { equals: 123 } });
    });

    it("ignores empty string values", () => {
      const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
      const result = parseFilter<{ name: string }, "name">({ nameContains: "" }, mappings);
      expect(result).toBeUndefined();
    });

    it("ignores null values", () => {
      const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
      const result = parseFilter<{ name: string }, "name">({ nameContains: null }, mappings);
      expect(result).toBeUndefined();
    });
  });

  describe("createFilterMappings", () => {
    it("creates filter mappings from field definitions", () => {
      const entity = { name: "", email: "", userId: 0 } as const;
      const mappings = createFilterMappings(entity, [
        { queryKey: "nameContains", field: "name", operator: "contains" },
        { queryKey: "emailContains", field: "email", operator: "contains" },
        { queryKey: "userId", field: "userId", operator: "equals" }
      ]);

      expect(mappings.nameContains).toEqual({ field: "name", operator: "contains" });
      expect(mappings.emailContains).toEqual({ field: "email", operator: "contains" });
      expect(mappings.userId).toEqual({ field: "userId", operator: "equals" });
    });

    it("uses equals as default operator", () => {
      const entity = { name: "" } as const;
      const mappings = createFilterMappings(entity, [
        { queryKey: "name", field: "name" }
      ]);

      expect(mappings.name).toEqual({ field: "name", operator: "equals" });
    });
  });

  describe("withSession", () => {
    it("disposes session after handler completes", async () => {
      let disposed = false;

      const mockSession = {
        dispose: async () => {
          disposed = true;
        }
      } as any;

      const createSession = () => mockSession;

      const result = await withSession(createSession, async (_session) => {
        return { id: 1 };
      });

      expect(result).toEqual({ id: 1 });
      expect(disposed).toBe(true);
    });

    it("disposes session even when handler throws", async () => {
      let disposed = false;

      const mockSession = {
        dispose: async () => {
          disposed = true;
        }
      } as any;

      const createSession = () => mockSession;

      await expect(
        withSession(createSession, async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      expect(disposed).toBe(true);
    });
  });

  describe("createPagedQueryDtoClass", () => {
    it("creates DTO with pagination fields", () => {
      const PagedQueryDto = createPagedQueryDtoClass();
      expect(PagedQueryDto.name).toBe("PagedQueryDto");
    });

    it("applies custom defaults", () => {
      const PagedQueryDto = createPagedQueryDtoClass({
        defaultPageSize: 50,
        maxPageSize: 200
      });
      expect(PagedQueryDto.name).toBe("PagedQueryDto");
    });

    it("uses custom name when provided", () => {
      const PagedQueryDto = createPagedQueryDtoClass({
        name: "UserPagedQueryDto"
      });
      const meta = getDtoMeta(PagedQueryDto);
      expect(meta?.name).toBe("UserPagedQueryDto");
    });
  });

  describe("createPagedResponseDtoClass", () => {
    it("creates DTO with pagination fields", () => {
      class ItemDto {}

      const PagedResponseDto = createPagedResponseDtoClass({
        itemDto: ItemDto as any,
        description: "Test response"
      });

      expect(PagedResponseDto.name).toBe("PagedResponseDto");
    });

    it("uses custom name when provided", () => {
      class ItemDto {}

      const PagedResponseDto = createPagedResponseDtoClass({
        itemDto: ItemDto as any,
        name: "UserPagedResponseDto"
      });

      const meta = getDtoMeta(PagedResponseDto);
      expect(meta?.name).toBe("UserPagedResponseDto");
    });
  });

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

  describe("createMetalDtoOverrides", () => {
    @Entity({ tableName: "posts" })
    class PostEntity {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.notNull(col.text()))
      title!: string;

      @Column(col.text())
      body?: string | null;

      @Column(col.references(col.notNull(col.int()), { table: "users", column: "id" }))
      userId!: number;

      @Column(col.notNull(col.text()))
      createdAt!: string;
    }

    @Entity({ tableName: "users" })
    class UserEntity {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.notNull(col.text()))
      name!: string;

      @Column(col.text())
      email?: string | null;

      @Column(col.notNull(col.text()))
      createdAt!: string;
    }

    it("generates ID convention for primary key", () => {
      const overrides = createMetalDtoOverrides(PostEntity);
      expect(overrides.id.kind).toBe("integer");
      expect((overrides.id as any).minimum).toBe(1);
      expect((overrides.id as any).description).toBe("PostEntity id.");
    });

    it("generates FK convention from references metadata", () => {
      const overrides = createMetalDtoOverrides(PostEntity);
      expect(overrides.userId.kind).toBe("integer");
      expect((overrides.userId as any).minimum).toBe(1);
      expect((overrides.userId as any).description).toBe("User id.");
    });

    it("generates minLength for required text columns", () => {
      const overrides = createMetalDtoOverrides(PostEntity);
      expect(overrides.title.kind).toBe("string");
      expect((overrides.title as any).minLength).toBe(1);
    });

    it("generates nullable for optional text columns", () => {
      const overrides = createMetalDtoOverrides(PostEntity);
      expect(overrides.body.kind).toBe("string");
      expect((overrides.body as any).nullable).toBe(true);
    });

    it("allows custom entity name for descriptions", () => {
      const overrides = createMetalDtoOverrides(PostEntity, {
        entityName: "Post"
      });
      expect((overrides.id as any).description).toBe("Post id.");
    });

    it("allows selective overrides", () => {
      const overrides = createMetalDtoOverrides(PostEntity, {
        overrides: {
          title: { kind: "string", minLength: 3, maxLength: 100 }
        }
      });
      expect((overrides.title as any).minLength).toBe(3);
      expect((overrides.title as any).maxLength).toBe(100);
    });

    it("excludes specified fields", () => {
      const overrides = createMetalDtoOverrides(PostEntity, {
        exclude: ["id", "createdAt"]
      });
      expect(overrides.id).toBeUndefined();
      expect(overrides.createdAt).toBeUndefined();
      expect(overrides.title).toBeDefined();
    });

    it("handles datetime type for timestamps", () => {
      @Entity({ tableName: "events" })
      class EventEntity {
        @PrimaryKey(col.autoIncrement(col.int()))
        id!: number;

        @Column(col.notNull(col.text()))
        name!: string;

        @Column(col.notNull(col.datetime()))
        eventDate!: string;
      }

      const overrides = createMetalDtoOverrides(EventEntity);
      expect(overrides.eventDate.kind).toBe("string");
      expect((overrides.eventDate as any).format).toBe("date-time");
    });

    it("extracts entity name from snake_case table name", () => {
      const overrides = createMetalDtoOverrides(UserEntity, {
        entityName: "User"
      });
      expect((overrides.id as any).description).toBe("User id.");
    });
  });
});
