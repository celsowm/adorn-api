import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryCacheProvider } from "../../src/core/cache";

describe("InMemoryCacheProvider", () => {
  let provider: InMemoryCacheProvider;

  beforeEach(() => {
    provider = new InMemoryCacheProvider();
  });

  it("should return undefined for missing key", async () => {
    const result = await provider.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("should store and retrieve a value", async () => {
    await provider.set("key1", { foo: "bar" }, 60);
    const result = await provider.get("key1");
    expect(result).toEqual({ foo: "bar" });
  });

  it("should expire entries after TTL", async () => {
    await provider.set("key1", "value", 0);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await provider.get("key1");
    expect(result).toBeUndefined();
  });

  it("should delete a specific key", async () => {
    await provider.set("key1", "value", 60);
    await provider.del("key1");
    const result = await provider.get("key1");
    expect(result).toBeUndefined();
  });

  it("should clear all entries", async () => {
    await provider.set("key1", "value1", 60);
    await provider.set("key2", "value2", 60);
    await provider.clear();
    expect(await provider.get("key1")).toBeUndefined();
    expect(await provider.get("key2")).toBeUndefined();
  });

  it("should store primitive values", async () => {
    await provider.set("str", "hello", 60);
    await provider.set("num", 42, 60);
    await provider.set("bool", true, 60);
    expect(await provider.get("str")).toBe("hello");
    expect(await provider.get("num")).toBe(42);
    expect(await provider.get("bool")).toBe(true);
  });

  it("should store arrays", async () => {
    const arr = [1, 2, 3];
    await provider.set("arr", arr, 60);
    expect(await provider.get("arr")).toEqual([1, 2, 3]);
  });
});
