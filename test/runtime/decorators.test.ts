import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fixtureRoot = resolve(__dirname, "../fixtures/users");

beforeAll(() => {
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
});

describe("Stage-3 Decorator Metadata", () => {
  it("should attach metadata to controller class via Symbol.metadata", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { readAdornBucket } = await import("../../dist/index.js");

    const bucket = readAdornBucket(UserController);

    expect(bucket).not.toBeNull();
    expect(bucket!.basePath).toBe("/users");
    expect(bucket!.ops).toHaveLength(3);

    const getOps = bucket!.ops.filter(op => op.httpMethod === "GET");
    expect(getOps).toHaveLength(2);
    expect(getOps.find(op => op.path === "/")).toBeDefined();
    expect(getOps.find(op => op.path === "/")?.methodName).toBe("getUsers");
    expect(getOps.find(op => op.path === "/:id")).toBeDefined();
    expect(getOps.find(op => op.path === "/:id")?.methodName).toBe("getUser");

    const postOp = bucket!.ops.find(op => op.httpMethod === "POST");
    expect(postOp).toBeDefined();
    expect(postOp!.path).toBe("/");
    expect(postOp!.methodName).toBe("createUser");
  });
});
