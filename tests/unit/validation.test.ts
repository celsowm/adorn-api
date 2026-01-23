import { describe, it, expect } from "vitest";
import { validate } from "../../src/core/validation";
import { ValidationErrors } from "../../src/core/validation-errors";
import { Dto, Field, t } from "../../src";

describe("Validation", () => {
  describe("Basic Type Validation", () => {
    it("should validate string type", () => {
      const errors1 = validate("test", t.string());
      expect(errors1).toEqual([]);

      const errors2 = validate(123, t.string());
      expect(errors2).toEqual([
        { field: "", message: "must be a string", value: 123 }
      ]);
    });

    it("should validate number type", () => {
      const errors1 = validate(123, t.number());
      expect(errors1).toEqual([]);

      const errors2 = validate("123", t.number());
      expect(errors2).toEqual([
        { field: "", message: "must be a number", value: "123" }
      ]);
    });

    it("should validate integer type", () => {
      const errors1 = validate(123, t.integer());
      expect(errors1).toEqual([]);

      const errors2 = validate(123.5, t.integer());
      expect(errors2).toEqual([
        { field: "", message: "must be an integer", value: 123.5 }
      ]);
    });

    it("should validate boolean type", () => {
      const errors1 = validate(true, t.boolean());
      expect(errors1).toEqual([]);

      const errors2 = validate("true", t.boolean());
      expect(errors2).toEqual([
        { field: "", message: "must be a boolean", value: "true" }
      ]);
    });

    it("should validate array type", () => {
      const errors1 = validate([1, 2, 3], t.array(t.number()));
      expect(errors1).toEqual([]);

      const errors2 = validate("not array", t.array(t.number()));
      expect(errors2).toEqual([
        { field: "", message: "must be an array", value: "not array" }
      ]);
    });

    it("should validate object type", () => {
      const errors1 = validate({ foo: "bar" }, t.object({ foo: t.string() }));
      expect(errors1).toEqual([]);

      const errors2 = validate("not object", t.object({ foo: t.string() }));
      expect(errors2).toEqual([
        { field: "", message: "must be an object", value: "not object" }
      ]);
    });
  });

  describe("String Constraints", () => {
    it("should validate minLength", () => {
      const errors1 = validate("abcd", t.string({ minLength: 4 }));
      expect(errors1).toEqual([]);

      const errors2 = validate("abc", t.string({ minLength: 4 }));
      expect(errors2).toEqual([
        { field: "", message: "must be at least 4 characters long", value: "abc" }
      ]);
    });

    it("should validate maxLength", () => {
      const errors1 = validate("abcd", t.string({ maxLength: 4 }));
      expect(errors1).toEqual([]);

      const errors2 = validate("abcde", t.string({ maxLength: 4 }));
      expect(errors2).toEqual([
        { field: "", message: "must be at most 4 characters long", value: "abcde" }
      ]);
    });

    it("should validate pattern", () => {
      const errors1 = validate("12345", t.string({ pattern: "\\d+" }));
      expect(errors1).toEqual([]);

      const errors2 = validate("abc123", t.string({ pattern: "^\\d+$" }));
      expect(errors2.length).toBeGreaterThan(0);
    });

    it("should validate UUID format", () => {
      const errors1 = validate("550e8400-e29b-41d4-a716-446655440000", t.uuid());
      expect(errors1).toEqual([]);

      const errors2 = validate("invalid-uuid", t.uuid());
      expect(errors2).toEqual([
        { field: "", message: "must be a valid UUID", value: "invalid-uuid" }
      ]);
    });

    it("should validate date-time format", () => {
      const errors1 = validate("2023-12-25T10:30:00Z", t.dateTime());
      expect(errors1).toEqual([]);

      const errors2 = validate("invalid-date", t.dateTime());
      expect(errors2).toEqual([
        { field: "", message: "must be a valid date-time", value: "invalid-date" }
      ]);
    });
  });

  describe("Number Constraints", () => {
    it("should validate minimum", () => {
      const errors1 = validate(10, t.number({ minimum: 10 }));
      expect(errors1).toEqual([]);

      const errors2 = validate(9, t.number({ minimum: 10 }));
      expect(errors2).toEqual([
        { field: "", message: "must be at least 10", value: 9 }
      ]);
    });

    it("should validate maximum", () => {
      const errors1 = validate(10, t.number({ maximum: 10 }));
      expect(errors1).toEqual([]);

      const errors2 = validate(11, t.number({ maximum: 10 }));
      expect(errors2).toEqual([
        { field: "", message: "must be at most 10", value: 11 }
      ]);
    });

    it("should validate exclusive minimum", () => {
      const errors1 = validate(11, t.number({ exclusiveMinimum: 10 }));
      expect(errors1).toEqual([]);

      const errors2 = validate(10, t.number({ exclusiveMinimum: 10 }));
      expect(errors2).toEqual([
        { field: "", message: "must be greater than 10", value: 10 }
      ]);
    });

    it("should validate exclusive maximum", () => {
      const errors1 = validate(9, t.number({ exclusiveMaximum: 10 }));
      expect(errors1).toEqual([]);

      const errors2 = validate(10, t.number({ exclusiveMaximum: 10 }));
      expect(errors2).toEqual([
        { field: "", message: "must be less than 10", value: 10 }
      ]);
    });

    it("should validate multipleOf", () => {
      const errors1 = validate(10, t.number({ multipleOf: 5 }));
      expect(errors1).toEqual([]);

      const errors2 = validate(7, t.number({ multipleOf: 5 }));
      expect(errors2).toEqual([
        { field: "", message: "must be a multiple of 5", value: 7 }
      ]);
    });
  });

  describe("Array Constraints", () => {
    it("should validate minItems", () => {
      const errors1 = validate([1, 2, 3], t.array(t.number(), { minItems: 3 }));
      expect(errors1).toEqual([]);

      const errors2 = validate([1, 2], t.array(t.number(), { minItems: 3 }));
      expect(errors2).toEqual([
        { field: "", message: "must have at least 3 items", value: [1, 2] }
      ]);
    });

    it("should validate maxItems", () => {
      const errors1 = validate([1, 2, 3], t.array(t.number(), { maxItems: 3 }));
      expect(errors1).toEqual([]);

      const errors2 = validate([1, 2, 3, 4], t.array(t.number(), { maxItems: 3 }));
      expect(errors2).toEqual([
        { field: "", message: "must have at most 3 items", value: [1, 2, 3, 4] }
      ]);
    });

    it("should validate uniqueItems", () => {
      const errors1 = validate([1, 2, 3], t.array(t.number(), { uniqueItems: true }));
      expect(errors1).toEqual([]);

      const errors2 = validate([1, 2, 2, 3], t.array(t.number(), { uniqueItems: true }));
      expect(errors2).toEqual([
        { field: "", message: "must contain unique items", value: [1, 2, 2, 3] }
      ]);
    });
  });

  describe("Object Constraints", () => {
    it("should validate required properties", () => {
      const errors1 = validate(
        { foo: "bar" },
        t.object({ foo: t.string() }, { required: ["foo"] })
      );
      expect(errors1).toEqual([]);

      const errors2 = validate({}, t.object({ foo: t.string() }, { required: ["foo"] }));
      expect(errors2).toEqual([
        { field: "foo", message: "is required", value: undefined }
      ]);
    });

    it("should validate additional properties", () => {
      const errors1 = validate({ foo: "bar" }, t.object({ foo: t.string() }));
      expect(errors1).toEqual([]);

      const errors2 = validate({ foo: "bar", baz: "qux" }, t.object({ foo: t.string() }));
      expect(errors2).toEqual([
        { field: "baz", message: "is not a valid field", value: "qux" }
      ]);

      const errors3 = validate({ foo: "bar", baz: "qux" }, t.object({ foo: t.string() }, { additionalProperties: true }));
      expect(errors3).toEqual([]);
    });

    it("should validate min/max properties", () => {
      const errors1 = validate({ foo: "bar", baz: "qux" }, t.object({ foo: t.string(), baz: t.string() }, { minProperties: 2, maxProperties: 2, additionalProperties: true }));
      expect(errors1).toEqual([]);

      const errors2 = validate({ foo: "bar" }, t.object({ foo: t.string() }, { minProperties: 2, additionalProperties: true }));
      expect(errors2).toEqual([
        { field: "", message: "must have at least 2 properties", value: { foo: "bar" } }
      ]);

      const errors3 = validate({ foo: "bar", baz: "qux", qux: "baz" }, t.object({ foo: t.string() }, { maxProperties: 2, additionalProperties: true }));
      expect(errors3).toEqual([
        { field: "", message: "must have at most 2 properties", value: { foo: "bar", baz: "qux", qux: "baz" } }
      ]);
    });
  });

  describe("DTO Validation", () => {
    @Dto()
    class TestDto {
      @Field(t.string({ minLength: 1 }))
      name!: string;

      @Field(t.optional(t.number()))
      age?: number;

      @Field(t.uuid())
      id!: string;
    }

    it("should validate DTO instance", () => {
      const errors1 = validate({
        name: "John Doe",
        id: "550e8400-e29b-41d4-a716-446655440000"
      }, TestDto);
      expect(errors1).toEqual([]);
    });

    it("should validate required fields", () => {
      const errors = validate({ id: "550e8400-e29b-41d4-a716-446655440000" }, TestDto);
      expect(errors).toEqual([
        { field: "name", message: "is required", value: undefined }
      ]);
    });

    it("should validate field constraints", () => {
      const errors = validate({
        name: "",
        id: "invalid-uuid"
      }, TestDto);
      expect(errors.length).toEqual(2);
    });
  });

  describe("Union and Optional", () => {
    it("should validate optional fields", () => {
      const errors1 = validate({ foo: "bar" }, t.object({ foo: t.optional(t.string()) }));
      expect(errors1).toEqual([]);

      const errors2 = validate({}, t.object({ foo: t.optional(t.string()) }));
      expect(errors2).toEqual([]);
    });

    it("should validate union types", () => {
      const errors1 = validate("test", t.union([t.string(), t.number()]));
      expect(errors1).toEqual([]);

      const errors2 = validate(123, t.union([t.string(), t.number()]));
      expect(errors2).toEqual([]);

      const errors3 = validate(true, t.union([t.string(), t.number()]));
      expect(errors3).toEqual([
        { field: "", message: "must match one of the allowed types", value: true }
      ]);
    });

    it("should validate nullable fields", () => {
      const errors1 = validate(null, t.nullable(t.string()));
      expect(errors1).toEqual([]);

      const errors2 = validate("test", t.nullable(t.string()));
      expect(errors2).toEqual([]);
    });
  });

  describe("ValidationErrors", () => {
    it("should throw ValidationErrors with multiple errors", () => {
      const errors = validate({}, t.object({
        foo: t.string(),
        bar: t.number()
      }, { required: ["foo", "bar"] }));
      
      expect(errors.length).toEqual(2);
    });

    it("should create ValidationErrors instance", () => {
      const errors = [
        { field: "foo", message: "is required", value: undefined }
      ];
      const validationErrors = new ValidationErrors(errors);
      
      expect(validationErrors).toBeInstanceOf(Error);
      expect(validationErrors.status).toEqual(400);
      expect(validationErrors.name).toEqual("ValidationErrors");
      expect(validationErrors.errors).toEqual(errors);
    });
  });
});
