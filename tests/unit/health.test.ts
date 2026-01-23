import { describe, it, expect } from "vitest";
import {
  createHealthController,
  databaseIndicator,
  memoryIndicator,
  customIndicator
} from "../../src/core/health";
import { getControllerMeta } from "../../src/core/metadata";
import type { RequestContext } from "../../src/core/../adapter/express/types";

const mockContext = {} as RequestContext;

describe("createHealthController", () => {
  it("creates a controller with default path /health", () => {
    const HealthController = createHealthController();
    const meta = getControllerMeta(HealthController);
    expect(meta?.basePath).toBe("/health");
  });

  it("creates a controller with custom path", () => {
    const HealthController = createHealthController({ path: "/status" });
    const meta = getControllerMeta(HealthController);
    expect(meta?.basePath).toBe("/status");
  });

  it("has three routes: /, /live, /ready", () => {
    const HealthController = createHealthController();
    const meta = getControllerMeta(HealthController);
    const paths = meta?.routes.map((r) => r.path).sort();
    expect(paths).toEqual(["/", "/live", "/ready"]);
  });

  it("returns healthy status with no indicators", async () => {
    const HealthController = createHealthController();
    const instance = new HealthController();
    const result = await instance.check(mockContext);
    expect(result.status).toBe("healthy");
    expect(result.timestamp).toBeDefined();
  });

  it("returns healthy status when all indicators are healthy", async () => {
    const HealthController = createHealthController({
      indicators: [
        customIndicator("service1", () => ({ status: "healthy" })),
        customIndicator("service2", () => ({ status: "healthy" }))
      ]
    });
    const instance = new HealthController();
    const result = await instance.check(mockContext);
    expect(result.status).toBe("healthy");
    expect(result.components?.service1?.status).toBe("healthy");
    expect(result.components?.service2?.status).toBe("healthy");
  });

  it("returns degraded status when any indicator is degraded", async () => {
    const HealthController = createHealthController({
      indicators: [
        customIndicator("service1", () => ({ status: "healthy" })),
        customIndicator("service2", () => ({ status: "degraded", message: "High latency" }))
      ]
    });
    const instance = new HealthController();
    const result = await instance.check(mockContext);
    expect(result.status).toBe("degraded");
    expect(result.components?.service2?.message).toBe("High latency");
  });

  it("returns unhealthy status when any indicator is unhealthy", async () => {
    const HealthController = createHealthController({
      indicators: [
        customIndicator("service1", () => ({ status: "healthy" })),
        customIndicator("service2", () => ({ status: "unhealthy" }))
      ]
    });
    const instance = new HealthController();
    const result = await instance.check(mockContext);
    expect(result.status).toBe("unhealthy");
  });

  it("catches indicator errors and marks as unhealthy", async () => {
    const HealthController = createHealthController({
      indicators: [
        customIndicator("failing", () => {
          throw new Error("Connection refused");
        })
      ]
    });
    const instance = new HealthController();
    const result = await instance.check(mockContext);
    expect(result.status).toBe("unhealthy");
    expect(result.components?.failing?.status).toBe("unhealthy");
    expect(result.components?.failing?.message).toBe("Connection refused");
  });

  it("liveness probe returns ok", () => {
    const HealthController = createHealthController();
    const instance = new HealthController();
    const result = instance.live(mockContext);
    expect(result.status).toBe("ok");
  });

  it("ready probe delegates to health check", async () => {
    const HealthController = createHealthController({
      indicators: [customIndicator("db", () => ({ status: "healthy" }))]
    });
    const instance = new HealthController();
    const result = await instance.ready(mockContext);
    expect(result.status).toBe("healthy");
    expect(result.components?.db).toBeDefined();
  });
});

describe("databaseIndicator", () => {
  it("returns healthy when ping succeeds", async () => {
    const indicator = databaseIndicator("postgres", async () => {});
    const result = await indicator.check();
    expect(result.status).toBe("healthy");
  });

  it("returns unhealthy when ping throws", async () => {
    const indicator = databaseIndicator("postgres", async () => {
      throw new Error("ECONNREFUSED");
    });
    const result = await indicator.check();
    expect(result.status).toBe("unhealthy");
    expect(result.message).toBe("ECONNREFUSED");
  });
});

describe("memoryIndicator", () => {
  it("returns memory usage data", async () => {
    const indicator = memoryIndicator();
    const result = await indicator.check();
    expect(result.data?.heapUsedMB).toBeTypeOf("number");
    expect(result.data?.heapTotalMB).toBeTypeOf("number");
    expect(result.data?.rssMB).toBeTypeOf("number");
  });

  it("returns healthy with low memory usage", async () => {
    const indicator = memoryIndicator({ degradedMB: 10000, unhealthyMB: 20000 });
    const result = await indicator.check();
    expect(result.status).toBe("healthy");
  });
});

describe("customIndicator", () => {
  it("creates indicator with custom key and check", async () => {
    const indicator = customIndicator("redis", async () => ({
      status: "healthy",
      data: { connections: 5 }
    }));
    expect(indicator.key).toBe("redis");
    const result = await indicator.check();
    expect(result.status).toBe("healthy");
    expect(result.data?.connections).toBe(5);
  });
});
