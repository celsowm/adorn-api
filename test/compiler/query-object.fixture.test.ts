import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";

const fixtureRoot = resolve(__dirname, "../fixtures/posts");

describe("Compiler Query Object Fixture", () => {
  it("should emit query args from object properties", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    expect(controllers).toHaveLength(1);

    const op = manifest.controllers[0].operations.find(o => o.operationId === "PostController_list");
    expect(op).toBeDefined();

    const queryArgs = op?.args.query ?? [];
    expect(queryArgs.some(q => (q as { name: string }).name === "status")).toBe(true);
    expect(queryArgs.some(q => (q as { name: string }).name === "responsavelId")).toBe(true);
    expect(queryArgs.some(q => (q as { name: string }).name === "query")).toBe(false);
  });
});
