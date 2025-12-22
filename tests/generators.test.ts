import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const loader = pathToFileURL(
  path.join(projectRoot, "node_modules", "ts-node", "esm.mjs")
).toString();

const tsNodeEnv = {
  ...process.env,
  TS_NODE_PROJECT: path.join(projectRoot, "tsconfig.json"),
  TS_NODE_PREFER_TS_EXTS: "true",
};

function runTsNodeScript(relativePath: string) {
  return new Promise<void>((resolve, reject) => {
    const scriptPath = path.join(projectRoot, relativePath);
    const child = spawn(
      process.execPath,
      ["--loader", loader, scriptPath],
      {
        cwd: projectRoot,
        env: tsNodeEnv,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Failed to run ${relativePath}\n${stderr}`));
    });
  });
}

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
