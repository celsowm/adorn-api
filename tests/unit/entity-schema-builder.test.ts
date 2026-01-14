import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { EntitySchemaBuilder } from "../../src/metal-orm-integration/entity-schema-builder.js";

describe("EntitySchemaBuilder", () => {
  const mockUserTableDef = {
    name: "users",
    columns: {
      id: {
        type: "bigint",
        notNull: true,
        primary: true,
        generated: true,
      },
      name: { type: "varchar", args: [255], notNull: true },
      email: { type: "varchar", args: [255], notNull: true },
      role: { type: "varchar", args: [50], notNull: false, default: "user" },
      createdAt: { type: "timestamp", notNull: true, generated: true },
    },
  };

  const mockPostTableDef = {
    name: "posts",
    columns: {
      id: { type: "int", notNull: true, primary: true, generated: true },
      title: { type: "varchar", args: [255], notNull: true },
      content: { type: "text", notNull: true },
      published: { type: "boolean", notNull: false, default: false },
      authorId: { type: "bigint", notNull: true },
      createdAt: { type: "timestamp", notNull: true, generated: true },
    },
  };

  beforeEach(() => {});

  describe("create()", () => {
    it("should generate create schema for User entity", () => {
      const schema = EntitySchemaBuilder.create({
        name: "User",
        tableDef: mockUserTableDef,
      });

      expect(schema).toBeInstanceOf(z.ZodObject);
      const shape = schema.shape;

      expect(shape.name).toBeDefined();
      expect(shape.email).toBeDefined();
      expect(shape.role).toBeDefined();
      expect(shape.id).toBeUndefined();
      expect(shape.createdAt).toBeUndefined();
    });

    it("should generate create schema for Post entity", () => {
      const schema = EntitySchemaBuilder.create({
        name: "Post",
        tableDef: mockPostTableDef,
      });
      const shape = schema.shape;

      expect(shape.title).toBeDefined();
      expect(shape.content).toBeDefined();
      expect(shape.published).toBeDefined();
      expect(shape.authorId).toBeDefined();
    });

    it("should exclude primary key and generated columns", () => {
      const schema = EntitySchemaBuilder.create({
        name: "User",
        tableDef: mockUserTableDef,
      });
      const shape = schema.shape;

      expect(shape.id).toBeUndefined();
      expect(shape.createdAt).toBeUndefined();
    });

    it("should throw error if entity not found", () => {
      expect(() => EntitySchemaBuilder.create({ name: "Unknown" })).toThrow(
        "Cannot get table definition from entity",
      );
    });

    it("should respect exclude option", () => {
      const schema = EntitySchemaBuilder.create(
        { name: "User", tableDef: mockUserTableDef },
        { exclude: ["role"] },
      );
      const shape = schema.shape;

      expect(shape.role).toBeUndefined();
      expect(shape.name).toBeDefined();
      expect(shape.email).toBeDefined();
    });

    it("should validate required fields", () => {
      const schema = EntitySchemaBuilder.create({
        name: "User",
        tableDef: mockUserTableDef,
      });

      const result = schema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should validate optional fields", () => {
      const schema = EntitySchemaBuilder.create({
        name: "User",
        tableDef: mockUserTableDef,
      });

      const result = schema.safeParse({
        name: "John",
        email: "john@example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("update()", () => {
    it("should generate update schema with all fields optional", () => {
      const schema = EntitySchemaBuilder.update({
        name: "User",
        tableDef: mockUserTableDef,
      });
      const shape = schema.shape;

      expect(shape.name).toBeDefined();
      expect(shape.email).toBeDefined();
      expect(shape.role).toBeDefined();
    });

    it("should make all fields optional", () => {
      const schema = EntitySchemaBuilder.update({
        name: "User",
        tableDef: mockUserTableDef,
      });

      const result = schema.safeParse({});
      expect(result.success).toBe(true);

      const partialResult = schema.safeParse({ name: "John" });
      expect(partialResult.success).toBe(true);
    });

    it("should exclude primary key and generated columns", () => {
      const schema = EntitySchemaBuilder.update({
        name: "User",
        tableDef: mockUserTableDef,
      });
      const shape = schema.shape;

      expect(shape.id).toBeUndefined();
      expect(shape.createdAt).toBeUndefined();
    });
  });

  describe("idParams()", () => {
    it("should generate ID params schema from primary key", () => {
      const schema = EntitySchemaBuilder.idParams({
        name: "User",
        tableDef: mockUserTableDef,
      });
      const shape = schema.shape;

      expect(shape.id).toBeDefined();
    });

    it("should use coerce.number().int() for bigint PK", () => {
      const schema = EntitySchemaBuilder.idParams({
        name: "User",
        tableDef: mockUserTableDef,
      });
      const result = schema.safeParse({ id: "123" });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.id).toBe(123);
      }
    });

    it("should default to int if no PK found", () => {
      const schema = EntitySchemaBuilder.idParams({
        name: "Unknown",
        tableDef: { columns: {} },
      });
      const result = schema.safeParse({ id: 1 });

      expect(result.success).toBe(true);
    });
  });

  describe("response()", () => {
    it("should generate OpenAPI response schema", () => {
      const schema = EntitySchemaBuilder.response({
        name: "User",
        tableDef: mockUserTableDef,
      });

      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties).toBeDefined();
    });

    it("should include all columns in response", () => {
      const schema = EntitySchemaBuilder.response({
        name: "User",
        tableDef: mockUserTableDef,
      });
      const props = schema.properties;

      expect(props.id).toBeDefined();
      expect(props.name).toBeDefined();
      expect(props.email).toBeDefined();
      expect(props.role).toBeDefined();
      expect(props.createdAt).toBeDefined();
    });

    it("should mark PK and generated as readOnly", () => {
      const schema = EntitySchemaBuilder.response({
        name: "User",
        tableDef: mockUserTableDef,
      });

      expect(schema.properties.id.readOnly).toBe(true);
      expect(schema.properties.createdAt.readOnly).toBe(true);
    });

    it("should include default values", () => {
      const schema = EntitySchemaBuilder.response({
        name: "User",
        tableDef: mockUserTableDef,
      });

      expect(schema.properties.role.default).toBe("user");
    });

    it("should set required fields based on notNull", () => {
      const schema = EntitySchemaBuilder.response({
        name: "User",
        tableDef: mockUserTableDef,
      });

      expect(schema.required).toContain("id");
      expect(schema.required).toContain("name");
      expect(schema.required).toContain("email");
      expect(schema.required).toContain("createdAt");
    });

    it("should respect exclude option", () => {
      const schema = EntitySchemaBuilder.response(
        { name: "User", tableDef: mockUserTableDef },
        { exclude: ["role"] },
      );

      expect(schema.properties.role).toBeUndefined();
    });
  });
});
