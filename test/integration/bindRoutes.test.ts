import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ManifestV1 } from "../../src/compiler/manifest/format.js";

const fixtureRoot = resolve(__dirname, "../fixtures/users");

beforeAll(() => {
  execSync("npm run build", { cwd: resolve(__dirname, "../.."), stdio: "inherit" });
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
});

describe("bindRoutes", () => {
  it("should merge runtime metadata with manifest", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { bindRoutes } = await import("../../dist/express.js");

    const manifest: ManifestV1 = {
      manifestVersion: 1,
      generatedAt: new Date().toISOString(),
      generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
      schemas: {
        kind: "openapi-3.1",
        file: "./openapi.json",
        componentsSchemasPointer: "/components/schemas",
      },
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
              args: { body: null, path: [], query: [], headers: [] },
              responses: [
                { status: 200, contentType: "application/json", schemaRef: "#/components/schemas/UserDto", isArray: true },
              ],
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
              },
              responses: [
                { status: 201, contentType: "application/json", schemaRef: "#/components/schemas/UserDto" },
              ],
            },
          ],
        },
      ],
    };

    const routes = bindRoutes({ controllers: [UserController], manifest });

    expect(routes).toHaveLength(2);
    expect(routes[0].fullPath).toBe("/users/");
    expect(routes[0].httpMethod).toBe("GET");
    expect(routes[1].fullPath).toBe("/users/");
    expect(routes[1].httpMethod).toBe("POST");
  });

  it("should throw on route drift", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { bindRoutes } = await import("../../dist/express.js");

    const badManifest: ManifestV1 = {
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
              http: { method: "GET", path: "/wrong" },
              handler: { methodName: "getUsers" },
              args: { body: null, path: [], query: [], headers: [] },
              responses: [],
            },
          ],
        },
      ],
    };

    expect(() => bindRoutes({ controllers: [UserController], manifest: badManifest }))
      .toThrow(/Route mismatch/);
  });
});
