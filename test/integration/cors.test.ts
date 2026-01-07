import { describe, it, expect, beforeAll, vi } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import request from "supertest";
import { bootstrap } from "../../dist/express.js";

const fixtureRoot = resolve(__dirname, "../fixtures/users");
const artifactsDir = resolve(fixtureRoot, ".adorn");

beforeAll(() => {
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
  execSync(`npx tsx "${resolve(__dirname, "../../src/cli.ts")}" build -p tsconfig.json --output .adorn`, {
    cwd: fixtureRoot,
    stdio: "inherit",
  });
});

describe("CORS Integration", () => {
  describe("Simple boolean CORS", () => {
    it("should enable CORS with cors: true", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://example.com");
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();

      await result.close();
      vi.unstubAllEnvs();
    });

    it("should allow all origins in development mode with localhost", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:*,http://127.0.0.1:*");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

      await result.close();
      vi.unstubAllEnvs();
    });

    it("should allow custom origins from env var", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://example.com,https://app.example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://app.example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");

      await result.close();
      vi.unstubAllEnvs();
    });
  });

  describe("Custom CORS configuration", () => {
    it("should restrict origins to whitelist array", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: ["https://allowed.com", "https://another.com"],
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://allowed.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.com");

      const blockedRes = await request(result.app)
        .get("/users/")
        .set("Origin", "https://notallowed.com");

      expect(blockedRes.status).toBe(200);
      expect(blockedRes.headers["access-control-allow-origin"]).toBeUndefined();

      await result.close();
    });

    it("should support RegExp origins", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: [/\.example\.com$/],
        },
        artifactsDir,
      });

      const res1 = await request(result.app)
        .get("/users/")
        .set("Origin", "https://api.example.com");

      expect(res1.status).toBe(200);
      expect(res1.headers["access-control-allow-origin"]).toBe("https://api.example.com");

      const res2 = await request(result.app)
        .get("/users/")
        .set("Origin", "https://other.com");

      expect(res2.status).toBe(200);
      expect(res2.headers["access-control-allow-origin"]).toBeUndefined();

      await result.close();
    });

    it("should support dynamic origin function", async () => {
      const originCheck = vi.fn((origin: string | undefined, callback: any) => {
        if (!origin) return callback(null, true);
        if (origin === "https://allowed.com") return callback(null, true);
        return callback(new Error("Not allowed"), false);
      });

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: originCheck,
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://allowed.com");

      expect(res.status).toBe(200);
      expect(originCheck).toHaveBeenCalledWith("https://allowed.com", expect.any(Function));

      await result.close();
    });

    it("should support credentials mode", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: "https://example.com",
          credentials: true,
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://example.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");

      await result.close();
    });

    it("should respect custom methods", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: true,
          methods: ["GET", "POST"],
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .options("/users/")
        .set("Origin", "http://example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-methods"]).toBe("GET,POST");

      await result.close();
      vi.unstubAllEnvs();
    });

    it("should respect custom headers", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: true,
          allowedHeaders: ["X-Custom-Header", "Authorization"],
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .options("/users/")
        .set("Origin", "http://example.com")
        .set("Access-Control-Request-Headers", "X-Custom-Header, Authorization");

      expect([200, 204]).toContain(res.status);
      const allowHeaders = res.headers["access-control-allow-headers"] as string;
      expect(allowHeaders).toBeDefined();
      expect(allowHeaders.toLowerCase()).toContain("x-custom-header");
      expect(allowHeaders.toLowerCase()).toContain("authorization");

      await result.close();
      vi.unstubAllEnvs();
    });
  });

  describe("Custom middleware function", () => {
    it("should support custom cors middleware function", async () => {
      const customHeader = "X-Custom-CORS";

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: (app) => {
          app.use((req, res, next) => {
            res.setHeader(customHeader, "custom-value");
            res.setHeader("Access-Control-Allow-Origin", "*");
            next();
          });
        },
        artifactsDir,
      });

      const res = await request(result.app).get("/users/");

      expect(res.status).toBe(200);
      expect(res.headers[customHeader.toLowerCase()]).toBe("custom-value");
      expect(res.headers["access-control-allow-origin"]).toBe("*");

      await result.close();
    });
  });

  describe("Preflight requests", () => {
    it("should handle OPTIONS requests correctly", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .options("/users/")
        .set("Origin", "http://example.com")
        .set("Access-Control-Request-Method", "POST");

      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe("http://example.com");

      await result.close();
      vi.unstubAllEnvs();
    });

    it("should cache preflight with maxAge", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: true,
          maxAge: 86400,
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .options("/users/")
        .set("Origin", "http://example.com");

      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-max-age"]).toBe("86400");

      await result.close();
      vi.unstubAllEnvs();
    });
  });

  describe("Security scenarios", () => {
    it("should reject unauthorized origins", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: ["https://allowed.com"],
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://notallowed.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();

      await result.close();
    });

    it("should allow no-origin requests (curl, mobile apps)", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: ["https://allowed.com"],
        },
        artifactsDir,
      });

      const res = await request(result.app).get("/users/");

      expect(res.status).toBe(200);

      await result.close();
    });

    it("should work with credentials and specific origin", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: "https://example.com",
          credentials: true,
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://example.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");

      await result.close();
    });
  });

  describe("Edge cases", () => {
    it("should handle wildcard origin", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: "*",
        },
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://anywhere.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("*");

      await result.close();
    });

    it("should handle multiple origins with mixed types", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: {
          origin: ["https://exact.com", /\.example\.com$/],
        },
        artifactsDir,
      });

      const res1 = await request(result.app)
        .get("/users/")
        .set("Origin", "https://exact.com");
      expect(res1.status).toBe(200);
      expect(res1.headers["access-control-allow-origin"]).toBe("https://exact.com");

      const res2 = await request(result.app)
        .get("/users/")
        .set("Origin", "https://api.example.com");
      expect(res2.status).toBe(200);
      expect(res2.headers["access-control-allow-origin"]).toBe("https://api.example.com");

      await result.close();
    });

    it("should disable CORS when cors: false", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: false,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();

      await result.close();
    });

    it("should disable CORS when cors: undefined", async () => {
      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();

      await result.close();
    });
  });

  describe("Integration with other features", () => {
    it("should work correctly with Swagger enabled", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        enableSwagger: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://example.com");

      await result.close();
      vi.unstubAllEnvs();
    });

    it("should allow GET and POST requests with CORS", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://example.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const getRes = await request(result.app)
        .get("/users/")
        .set("Origin", "http://example.com");

      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);
      expect(getRes.headers["access-control-allow-origin"]).toBe("http://example.com");

      const postRes = await request(result.app)
        .post("/users/")
        .set("Origin", "http://example.com")
        .send({ name: "Test User", phone: "123" });

      expect(postRes.status).toBe(201);
      expect(postRes.body.name).toBe("Test User");
      expect(postRes.headers["access-control-allow-origin"]).toBe("http://example.com");

      await result.close();
      vi.unstubAllEnvs();
    });
  });

  describe("Environment variable behavior", () => {
    it("should use wildcard when CORS_ALLOWED_ORIGINS is *", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "*");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "http://anywhere.com");

      expect(res.status).toBe(200);

      await result.close();
      vi.unstubAllEnvs();
    });

    it("should parse comma-separated origins from env var", async () => {
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://first.com,https://second.com,https://third.com");

      const controllerPath = resolve(fixtureRoot, "dist/controller.js");
      const mod = await import(pathToFileURL(controllerPath).href);
      const { UserController } = mod;

      const result = await bootstrap({
        controllers: [UserController],
        cors: true,
        artifactsDir,
      });

      const res = await request(result.app)
        .get("/users/")
        .set("Origin", "https://second.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://second.com");

      await result.close();
      vi.unstubAllEnvs();
    });
  });
});
