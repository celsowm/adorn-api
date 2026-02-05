import { describe, expect, it } from "vitest";
import { parseIdOrThrow } from "../../src/adapter/metal-orm/index";
import { HttpError } from "../../src/core/errors";

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
