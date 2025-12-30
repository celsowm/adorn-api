import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fixtureRoot = resolve(__dirname, "../fixtures/users");

beforeAll(() => {
  execSync("npm run build", { cwd: resolve(__dirname, "../.."), stdio: "inherit" });
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
    expect(bucket!.ops).toHaveLength(2);

    const getOp = bucket!.ops.find(op => op.httpMethod === "GET");
    expect(getOp).toBeDefined();
    expect(getOp!.path).toBe("/");
    expect(getOp!.methodName).toBe("getUsers");

    const postOp = bucket!.ops.find(op => op.httpMethod === "POST");
    expect(postOp).toBeDefined();
    expect(postOp!.path).toBe("/");
    expect(postOp!.methodName).toBe("createUser");
  });
});
