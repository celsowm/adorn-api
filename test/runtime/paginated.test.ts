import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fixtureRoot = resolve(__dirname, "../fixtures/paginated");

describe("@Paginated decorator", () => {
  it("should attach pagination config to route operation", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { TasksController } = mod;

    const { readAdornBucket } = await import("../../dist/index.js") as { readAdornBucket: any };

    const bucket = readAdornBucket(TasksController);

    expect(bucket).not.toBeNull();
    expect(bucket!.ops).toHaveLength(2);

    const listOp = bucket!.ops.find((op: any) => op.methodName === "list");
    expect(listOp).toBeDefined();
    expect(listOp!.pagination).toBeDefined();
    expect(listOp!.pagination!.defaultPageSize).toBe(10);

    const customListOp = bucket!.ops.find((op: any) => op.methodName === "customList");
    expect(customListOp).toBeDefined();
    expect(customListOp!.pagination).toBeDefined();
    expect(customListOp!.pagination!.defaultPageSize).toBe(20);
  });

  it("should set default pageSize to 10 when not specified", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { TasksController } = mod;

    const { readAdornBucket } = await import("../../dist/index.js") as { readAdornBucket: any };

    const bucket = readAdornBucket(TasksController);
    const listOp = bucket!.ops.find((op: any) => op.methodName === "list");

    expect(listOp!.pagination!.defaultPageSize).toBe(10);
  });
});
