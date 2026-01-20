import { describe, expect, it } from "vitest";
import {
  normalizeSingle,
  parseBoolean,
  parseId,
  parseInteger,
  parseNumber
} from "../coerce";

describe("coerce helpers", () => {
  it("normalizes single values", () => {
    expect(normalizeSingle([" 1 "])).toBe("1");
    expect(normalizeSingle("")).toBeUndefined();
    expect(normalizeSingle("", { empty: "allow" })).toBe("");
  });

  it("parses numbers with range controls", () => {
    expect(parseNumber(" 1.5 ")).toBe(1.5);
    expect(parseNumber("nope")).toBeUndefined();
    expect(parseNumber("10", { max: 5 })).toBeUndefined();
    expect(parseNumber("10", { max: 5, clamp: true })).toBe(5);
  });

  it("parses integers and ids", () => {
    expect(parseInteger("2")).toBe(2);
    expect(parseInteger("2.2")).toBeUndefined();
    expect(parseInteger("-2", { min: 0, clamp: true })).toBe(0);
    expect(parseId("1")).toBe(1);
    expect(parseId("0")).toBeUndefined();
    expect(parseId("0", { min: 0 })).toBe(0);
  });

  it("parses booleans", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("FALSE")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("yes")).toBeUndefined();
  });
});
