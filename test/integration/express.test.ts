import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import request from "supertest";
import type { ManifestV1 } from "../../src/compiler/manifest/format.js";

const fixtureRoot = resolve(__dirname, "../fixtures/users");

beforeAll(() => {
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
});

describe("Express Integration", () => {
  it("should handle GET and POST requests", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { createExpressRouter } = await import("../../dist/express.js");

    const manifest: ManifestV1 = {
      manifestVersion: 1,
      generatedAt: new Date().toISOString(),
      generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
      schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
      validation: { mode: "none", precompiledModule: null },
      controllers: [
        {
          controllerId: "UserController",
          basePath: "/users",
          operations: [
            {
              operationId: "UserController_getUsers",
              http: { method: "GET", path: "/" },
              handler: { methodName: "getUsers" },
              args: { body: null, path: [], query: [], headers: [], cookies: [] },
              responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/UserDto", isArray: true }],
            },
            {
              operationId: "UserController_getUser",
              http: { method: "GET", path: "/:id" },
              handler: { methodName: "getUser" },
              args: {
                body: null,
                path: [{ name: "id", index: 0, required: true, schemaRef: "#/components/schemas/Number", schemaType: "number" }],
                query: [{ name: "verbose", index: 1, required: false, schemaRef: "#/components/schemas/Boolean", schemaType: "boolean" }],
                headers: [],
                cookies: [],
              },
              responses: [{ status: 200, contentType: "application/json", schemaRef: "#/components/schemas/UserDto" }],
            },
            {
              operationId: "UserController_createUser",
              http: { method: "POST", path: "/" },
              handler: { methodName: "createUser" },
              args: {
                body: { index: 0, required: true, contentType: "application/json", schemaRef: "#/components/schemas/CreateUserPayload" },
                path: [],
                query: [],
                headers: [],
                cookies: [],
              },
              responses: [{ status: 201, contentType: "application/json", schemaRef: "#/components/schemas/UserDto" }],
            },
          ],
        },
      ],
    };

    const openapi = {
      openapi: "3.1.0",
      components: {
        schemas: {
          UserDto: {
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string" },
              phone: { type: ["string", "null"] },
              role: { type: "string", enum: ["admin", "user"] },
            },
            required: ["id", "name", "phone", "role"],
          },
          CreateUserPayload: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              age: { type: "number" },
            },
            required: ["name", "phone"],
          },
        },
      },
    };

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [UserController], manifest, openapi }));

    const getRes = await request(app).get("/users/");
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);

    const postRes = await request(app)
      .post("/users/")
      .send({ name: "Test User", phone: "+1 234 567" });
    expect(postRes.status).toBe(201);
    expect(postRes.body.name).toBe("Test User");
  });
});
