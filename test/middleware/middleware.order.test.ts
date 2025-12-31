import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import express from "express";
import request from "supertest";
import { Controller, Get, Use, Auth, Public } from "../../dist/index.js";
import { createExpressRouter } from "../../dist/express.js";

beforeAll(() => {
  execSync("npm run build", { cwd: resolve(__dirname, "../.."), stdio: "inherit" });
});

const openapi = {
  openapi: "3.1.0",
  components: {
    schemas: {
      Object: {
        type: "object",
      },
    },
  },
};

describe("middleware order", () => {
  it("should apply global, controller, and route middleware in order", async () => {
    const executionOrder: string[] = [];

    const globalMw = (req: any, res: any, next: any) => {
      executionOrder.push("global");
      next();
    };

    const controllerMw = (req: any, res: any, next: any) => {
      executionOrder.push("controller");
      next();
    };

    const routeMw = (req: any, res: any, next: any) => {
      executionOrder.push("route");
      next();
    };

    @Controller("/test")
    @Use(controllerMw)
    class TestController {
      @Get("/")
      @Use(routeMw)
      test() {
        executionOrder.push("handler");
        return { success: true };
      }
    }

    const app = express();
    app.use(createExpressRouter({
      controllers: [TestController],
      manifest: {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
        schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
        validation: { mode: "none", precompiledModule: null },
        controllers: [
          {
            controllerId: "TestController",
            basePath: "/test",
            operations: [
              {
                operationId: "TestController_test",
                http: { method: "GET", path: "/" },
                handler: { methodName: "test" },
                args: { body: null, path: [], query: [], headers: [], cookies: [] },
                responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/Object" }],
              },
            ],
          },
        ],
      },
      openapi,
      middleware: {
        global: [globalMw],
      },
    }));

    await request(app).get("/test/");
    expect(executionOrder).toEqual(["global", "controller", "route", "handler"]);
  });

  it("should support named middleware", async () => {
    const namedMw = (req: any, res: any, next: any) => {
      req.namedMwExecuted = true;
      next();
    };

    @Controller("/test")
    class TestController {
      @Get("/")
      @Use("namedMiddleware")
      test() {
        return { success: true };
      }
    }

    const app = express();
    app.use(createExpressRouter({
      controllers: [TestController],
      manifest: {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
        schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
        validation: { mode: "none", precompiledModule: null },
        controllers: [
          {
            controllerId: "TestController",
            basePath: "/test",
            operations: [
              {
                operationId: "TestController_test",
                http: { method: "GET", path: "/" },
                handler: { methodName: "test" },
                args: { body: null, path: [], query: [], headers: [], cookies: [] },
                responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/Object" }],
              },
            ],
          },
        ],
      },
      openapi,
      middleware: {
        named: { namedMiddleware: namedMw },
      },
    }));

    const res = await request(app).get("/test/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("auth", () => {
  it("should enforce required auth", async () => {
    const bearerRuntime = {
      name: "BearerAuth",
      async authenticate(req: any) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer ")) return null;
        if (auth !== "Bearer valid-token") return null;
        return { principal: { userId: 1 }, scopes: ["read"] };
      },
      challenge(res: any) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="access"');
        res.status(401).json({ error: "Unauthorized" });
      },
      authorize(auth: any, requiredScopes: string[]) {
        return requiredScopes.every(scope => auth.scopes?.includes(scope));
      },
    };

    @Controller("/test")
    class TestController {
      @Get("/")
      @Auth("BearerAuth")
      test() {
        return { authenticated: true };
      }
    }

    const app = express();
    app.use(createExpressRouter({
      controllers: [TestController],
      manifest: {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
        schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
        validation: { mode: "none", precompiledModule: null },
        controllers: [
          {
            controllerId: "TestController",
            basePath: "/test",
            operations: [
              {
                operationId: "TestController_test",
                http: { method: "GET", path: "/" },
                handler: { methodName: "test" },
                args: { body: null, path: [], query: [], headers: [], cookies: [] },
                responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/Object" }],
              },
            ],
          },
        ],
      },
      openapi,
      auth: {
        schemes: { BearerAuth: bearerRuntime },
      },
    }));

    const noAuthRes = await request(app).get("/test/");
    expect(noAuthRes.status).toBe(401);

    const validRes = await request(app)
      .get("/test/")
      .set("Authorization", "Bearer valid-token");
    expect(validRes.status).toBe(200);
    expect(validRes.body.authenticated).toBe(true);
  });

  it("should allow @Public to skip auth", async () => {
    const bearerRuntime = {
      name: "BearerAuth",
      async authenticate(req: any) {
        return null;
      },
      challenge(res: any) {
        res.status(401).json({ error: "Unauthorized" });
      },
    };

    @Controller("/test")
    class TestController {
      @Get("/public")
      @Public()
      publicEndpoint() {
        return { public: true };
      }

      @Get("/protected")
      @Auth("BearerAuth")
      protectedEndpoint() {
        return { protected: true };
      }
    }

    const app = express();
    app.use(createExpressRouter({
      controllers: [TestController],
      manifest: {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
        schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
        validation: { mode: "none", precompiledModule: null },
        controllers: [
          {
            controllerId: "TestController",
            basePath: "/test",
            operations: [
              {
                operationId: "TestController_publicEndpoint",
                http: { method: "GET", path: "/public" },
                handler: { methodName: "publicEndpoint" },
                args: { body: null, path: [], query: [], headers: [], cookies: [] },
                responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/Object" }],
              },
              {
                operationId: "TestController_protectedEndpoint",
                http: { method: "GET", path: "/protected" },
                handler: { methodName: "protectedEndpoint" },
                args: { body: null, path: [], query: [], headers: [], cookies: [] },
                responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/Object" }],
              },
            ],
          },
        ],
      },
      openapi,
      auth: {
        schemes: { BearerAuth: bearerRuntime },
      },
    }));

    const publicRes = await request(app).get("/test/public");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.public).toBe(true);

    const protectedRes = await request(app).get("/test/protected");
    expect(protectedRes.status).toBe(401);
  });

  it("should support optional auth", async () => {
    const bearerRuntime = {
      name: "BearerAuth",
      async authenticate(req: any) {
        const auth = req.headers.authorization;
        if (!auth) return null;
        if (auth !== "Bearer valid") return null;
        return { principal: { userId: 1 } };
      },
      challenge(res: any) {
        res.status(401).json({ error: "Unauthorized" });
      },
    };

    @Controller("/test")
    class TestController {
      @Get("/")
      @Auth("BearerAuth", { optional: true })
      test(req: any) {
        return { user: req.auth };
      }
    }

    const app = express();
    app.use(createExpressRouter({
      controllers: [TestController],
      manifest: {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
        schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
        validation: { mode: "none", precompiledModule: null },
        controllers: [
          {
            controllerId: "TestController",
            basePath: "/test",
            operations: [
              {
                operationId: "TestController_test",
                http: { method: "GET", path: "/" },
                handler: { methodName: "test" },
                args: { body: null, path: [], query: [], headers: [], cookies: [] },
                responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/Object" }],
              },
            ],
          },
        ],
      },
      openapi,
      auth: {
        schemes: { BearerAuth: bearerRuntime },
      },
    }));

    const noAuthRes = await request(app).get("/test/");
    expect(noAuthRes.status).toBe(200);
    expect(noAuthRes.body.user).toBeNull();

    const validRes = await request(app)
      .get("/test/")
      .set("Authorization", "Bearer valid");
    expect(validRes.status).toBe(200);
    expect(validRes.body.user.userId).toBe(1);
  });
});
