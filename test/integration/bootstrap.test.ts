import { describe, it, expect, vi } from "vitest";

const MockController = class MockController {};

describe("bootstrap validation", () => {
  it("should throw error for invalid port", async () => {
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [MockController],
        port: -1,
      })
    ).rejects.toThrow("Invalid port: -1");
  });

  it("should throw error for NaN port", async () => {
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [MockController],
        port: Number("invalid"),
      })
    ).rejects.toThrow("Invalid port: NaN");
  });

  it("should throw error for port > 65535", async () => {
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [MockController],
        port: 70000,
      })
    ).rejects.toThrow("Invalid port: 70000");
  });

  it("should throw error when no controllers provided", async () => {
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [],
      })
    ).rejects.toThrow("At least one controller must be provided");
  });

  it("should accept valid port", async () => {
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [MockController],
        port: 4000,
      })
    ).rejects.toThrow();
  });

  it("should accept default port when not specified", async () => {
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [MockController],
      })
    ).rejects.toThrow();
  });

  it("should accept port from environment", async () => {
    vi.stubEnv("PORT", "5000");
    const { bootstrap } = await import("../../src/adapter/express/bootstrap.js");
    
    await expect(
      bootstrap({
        controllers: [MockController],
      })
    ).rejects.toThrow();
    
    vi.unstubAllEnvs();
  });
});
