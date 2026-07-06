import { describe, it, expect } from "vitest";
import { buildCacheKey, shouldCacheResult, isCacheableMethod } from "../../src/core/cache-utils";

describe("buildCacheKey", () => {
  it("should use method:path by default", () => {
    const key = buildCacheKey("get", "/users/:id", {});
    expect(key).toBe("get:/users/:id");
  });

  it("should use fixed key when provided", () => {
    const key = buildCacheKey("get", "/users", { key: "users-all" });
    expect(key).toBe("get:users-all");
  });

  it("should include paramKeys values", () => {
    const key = buildCacheKey("get", "/users/:id", {
      paramKeys: ["id"]
    }, { id: "123" });
    expect(key).toBe("get:/users/:id:123");
  });

  it("should skip missing paramKeys values", () => {
    const key = buildCacheKey("get", "/users/:id", {
      paramKeys: ["id", "lang"]
    }, { id: "123" });
    expect(key).toBe("get:/users/:id:123");
  });

  it("should handle multiple paramKeys", () => {
    const key = buildCacheKey("get", "/search", {
      paramKeys: ["q", "page"]
    }, { q: "foo", page: "1" });
    expect(key).toBe("get:/search:foo:1");
  });
});

describe("shouldCacheResult", () => {
  it("should return true when no condition is set", () => {
    expect(shouldCacheResult(undefined, { data: "ok" })).toBe(true);
  });

  it("should return true when condition returns true", () => {
    const condition = (result: unknown) => (result as any)?.status === "ok";
    expect(shouldCacheResult(condition, { status: "ok" })).toBe(true);
  });

  it("should return false when condition returns false", () => {
    const condition = (result: unknown) => (result as any)?.status === "ok";
    expect(shouldCacheResult(condition, { status: "error" })).toBe(false);
  });
});

describe("isCacheableMethod", () => {
  it("should return true for GET", () => {
    expect(isCacheableMethod("get")).toBe(true);
    expect(isCacheableMethod("GET")).toBe(true);
  });

  it("should return true for HEAD", () => {
    expect(isCacheableMethod("head")).toBe(true);
  });

  it("should return false for POST", () => {
    expect(isCacheableMethod("post")).toBe(false);
  });

  it("should return false for PUT, DELETE, PATCH", () => {
    expect(isCacheableMethod("put")).toBe(false);
    expect(isCacheableMethod("delete")).toBe(false);
    expect(isCacheableMethod("patch")).toBe(false);
  });
});
