import { describe, expect, it } from "vitest";
import { createMetalDtoOverrides } from "../../src/adapter/metal-orm/index";
import { Column, Entity, PrimaryKey, col } from "metal-orm";

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
