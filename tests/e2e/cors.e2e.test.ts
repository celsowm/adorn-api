import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { Controller, Get, createExpressApp } from "../../src/index";

@Controller("/test")
class TestController {
  @Get("/hello")
  hello() {
    return { message: "hello" };
  }
}

describe("CORS middleware", () => {
  describe("cors: true (permissive defaults)", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({ controllers: [TestController], cors: true });
    });

    it("allows all origins with wildcard", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://example.com");
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("handles preflight OPTIONS requests", async () => {
      const res = await request(app)
        .options("/test/hello")
        .set("Origin", "https://example.com")
        .set("Access-Control-Request-Method", "GET");
      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-methods"]).toContain("GET");
      expect(res.headers["access-control-allow-headers"]).toContain("Content-Type");
    });
  });

  describe("cors with specific origin", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({
        controllers: [TestController],
        cors: { origin: "https://allowed.com" }
      });
    });

    it("allows matching origin", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://allowed.com");
      expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.com");
    });

    it("does not set header for non-matching origin", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://not-allowed.com");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("cors with origin array", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({
        controllers: [TestController],
        cors: { origin: ["https://a.com", "https://b.com"] }
      });
    });

    it("allows origins in the list", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://a.com");
      expect(res.headers["access-control-allow-origin"]).toBe("https://a.com");
    });

    it("does not allow origins not in the list", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://c.com");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("cors with dynamic origin function", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({
        controllers: [TestController],
        cors: { origin: (origin) => origin?.endsWith(".trusted.com") ?? false }
      });
    });

    it("allows origins matching the function", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://api.trusted.com");
      expect(res.headers["access-control-allow-origin"]).toBe("https://api.trusted.com");
    });

    it("rejects origins not matching the function", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://evil.com");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("cors with credentials", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({
        controllers: [TestController],
        cors: { origin: "https://app.com", credentials: true }
      });
    });

    it("sets credentials header", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://app.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("sets Vary header for non-wildcard origin", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://app.com");
      expect(res.headers["vary"]).toBe("Origin");
    });
  });

  describe("cors with exposed headers", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({
        controllers: [TestController],
        cors: { exposedHeaders: ["X-Custom-Header", "X-Request-Id"] }
      });
    });

    it("sets exposed headers", async () => {
      const res = await request(app)
        .get("/test/hello")
        .set("Origin", "https://example.com");
      expect(res.headers["access-control-expose-headers"]).toBe("X-Custom-Header, X-Request-Id");
    });
  });

  describe("cors with custom methods and headers", () => {
    let app: Express;

    beforeAll(async () => {
      app = await createExpressApp({
        controllers: [TestController],
        cors: {
          methods: ["GET", "POST"],
          allowedHeaders: ["X-API-Key"],
          maxAge: 3600
        }
      });
    });

    it("uses custom methods in preflight", async () => {
      const res = await request(app)
        .options("/test/hello")
        .set("Origin", "https://example.com")
        .set("Access-Control-Request-Method", "POST");
      expect(res.headers["access-control-allow-methods"]).toBe("GET, POST");
      expect(res.headers["access-control-allow-headers"]).toBe("X-API-Key");
      expect(res.headers["access-control-max-age"]).toBe("3600");
    });
  });
});
