import { describe, it, expect } from "vitest";
import { serializeResponse } from "../../src/adapter/express/response-serializer";
import { t } from "../../src/core/schema";

describe("serializeResponse", () => {
  describe("Buffer with format: byte", () => {
    it("serializes Buffer to base64 string when format is byte", () => {
      const buffer = Buffer.from("Hello, World!");
      const schema = t.bytes();

      const result = serializeResponse(buffer, schema);

      expect(result).toBe("SGVsbG8sIFdvcmxkIQ==");
    });

    it("serializes Buffer in object property with format: byte", () => {
      const data = { content: Buffer.from("binary data") };
      const schema = t.object({ content: t.bytes() });

      const result = serializeResponse(data, schema);

      expect(result).toEqual({ content: "YmluYXJ5IGRhdGE=" });
    });

    it("serializes Buffer in array with format: byte", () => {
      const data = [Buffer.from("first"), Buffer.from("second")];
      const schema = t.array(t.bytes());

      const result = serializeResponse(data, schema);

      expect(result).toEqual(["Zmlyc3Q=", "c2Vjb25k"]);
    });

    it("handles empty Buffer", () => {
      const buffer = Buffer.alloc(0);
      const schema = t.bytes();

      const result = serializeResponse(buffer, schema);

      expect(result).toBe("");
    });

    it("handles binary data (non-UTF8)", () => {
      const buffer = Buffer.from([0x00, 0xff, 0x80, 0x7f]);
      const schema = t.bytes();

      const result = serializeResponse(buffer, schema);

      expect(result).toBe("AP+Afw==");
    });

    it("does not affect non-Buffer values with format: byte", () => {
      const schema = t.bytes();

      expect(serializeResponse("already a string", schema)).toBe("already a string");
      expect(serializeResponse(123, schema)).toBe(123);
      expect(serializeResponse(null, schema)).toBe(null);
    });

    it("does not convert Buffer to base64 when format is not byte", () => {
      const buffer = Buffer.from("test");
      const schema = t.string();

      const result = serializeResponse(buffer, schema);

      expect(result).toEqual(buffer);
    });
  });

  describe("Date serialization (unchanged)", () => {
    it("serializes Date to ISO string for date-time format", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const schema = t.dateTime();

      const result = serializeResponse(date, schema);

      expect(result).toBe("2024-01-15T10:30:00.000Z");
    });

    it("serializes Date to date string for date format", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const schema = t.string({ format: "date" });

      const result = serializeResponse(date, schema);

      expect(result).toBe("2024-01-15");
    });

    it("does not serialize invalid Date", () => {
      const date = new Date("invalid");
      const schema = t.dateTime();

      const result = serializeResponse(date, schema);

      expect(result).toBe(date);
    });
  });

  describe("record with bytes values", () => {
    it("serializes all Buffer values in a record to base64", () => {
      const data = {
        file1: Buffer.from("content1"),
        file2: Buffer.from("content2"),
      };
      const schema = t.record(t.bytes());

      const result = serializeResponse(data, schema);

      expect(result).toEqual({
        file1: "Y29udGVudDE=",
        file2: "Y29udGVudDI=",
      });
    });
  });

  describe("union with bytes", () => {
    it("serializes Buffer in union when format is byte", () => {
      const buffer = Buffer.from("union content");
      const schema = t.union([t.bytes(), t.string()]);

      const result = serializeResponse(buffer, schema);

      expect(result).toBe("dW5pb24gY29udGVudA==");
    });
  });
});

describe("t.bytes() helper", () => {
  it("creates a string schema with format: byte", () => {
    const schema = t.bytes();

    expect(schema).toEqual({
      kind: "string",
      format: "byte",
    });
  });

  it("accepts additional options", () => {
    const schema = t.bytes({ description: "Binary data" });

    expect(schema).toEqual({
      kind: "string",
      format: "byte",
      description: "Binary data",
    });
  });
});
