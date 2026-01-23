import { describe, expect, it } from "vitest";
import { t, type SchemaNode } from "../../src/core/schema";
import {
  buildSchemaFromNode,
  buildSchemaFromDto,
  createSchemaContext
} from "../../src/core/schema-builder";
import { registerDto } from "../../src/core/metadata";

describe("schema builder", () => {
  it("maps primitive string options", () => {
    const schema = buildSchemaFromNode(
      t.string({ minLength: 2, maxLength: 4, pattern: "^[a-z]+$" }),
      createSchemaContext()
    );

    expect(schema).toEqual({
      type: "string",
      minLength: 2,
      maxLength: 4,
      pattern: "^[a-z]+$"
    });
  });

  it("adds nullability to schemas", () => {
    const schema = buildSchemaFromNode(
      t.nullable(t.integer({ minimum: 1 })),
      createSchemaContext()
    );

    expect(schema).toEqual({
      type: ["integer", "null"],
      minimum: 1
    });
  });

  it("builds dto schemas into components", () => {
    class UserDto {
      name!: string;
      nickname?: string;
    }

    registerDto(UserDto, {
      name: "UserDto",
      fields: {
        name: { schema: t.string({ minLength: 1 }) },
        nickname: { schema: t.optional(t.string()) }
      },
      additionalProperties: false
    });

    const context = createSchemaContext();
    const ref = buildSchemaFromDto(UserDto, context);

    expect(ref).toEqual({ $ref: "#/components/schemas/UserDto" });
    expect(context.components.UserDto).toEqual({
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        nickname: { type: "string" }
      },
      required: ["name"],
      additionalProperties: false
    });
  });

  it("supports arrays and enums", () => {
    const schemaNode: SchemaNode = t.array(
      t.enum(["draft", "published", "archived"])
    );

    const schema = buildSchemaFromNode(schemaNode, createSchemaContext());

    expect(schema).toEqual({
      type: "array",
      items: {
        enum: ["draft", "published", "archived"],
        type: "string"
      }
    });
  });
});
