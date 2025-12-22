import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot, runTsNodeScript } from "./utils.js";

describe("adorn-api generators", () => {
  it("writes swagger.json with expected routes", async () => {
    await runTsNodeScript("src/cli/generate-swagger.ts");
const swaggerPath = path.join(projectRoot, "swagger.json");
    const swagger = JSON.parse(await readFile(swaggerPath, "utf-8"));

    expect(swagger.openapi).toBe("3.0.0");
    expect(Object.keys(swagger.paths)).toEqual(
      expect.arrayContaining([
        "/users/{userId}",
        "/users/",
        "/advanced/{tenantId}/users",
        "/advanced/",
      ])
    );

    const userGet = swagger.paths["/users/{userId}"]?.get;
    expect(userGet?.operationId).toBe("getUser");

    const advancedGet = swagger.paths["/advanced/{tenantId}/users"]?.get;
    const hasTenantId = advancedGet?.parameters?.some(
      (param: { name: string; in: string }) =>
        param.name === "tenantId" && param.in === "path"
    );
    expect(hasTenantId).toBe(true);
  });

  it("writes express routes from controllers", async () => {
    await runTsNodeScript("src/cli/generate-routes.ts");
    const routesPath = path.join(
      projectRoot,
      "tests",
      "example-app",
      "routes.ts"
    );
    const routes = await readFile(routesPath, "utf-8");

    expect(routes).toContain("RegisterRoutes");
    expect(routes).toContain("app.get('/users/:userId'");
    expect(routes).toContain("app.post('/users/'");
    expect(routes).toContain("new UserController()");
  });
});
