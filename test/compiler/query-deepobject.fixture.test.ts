import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";

const fixtureRoot = resolve(__dirname, "../fixtures/posts");

describe("Compiler DeepObject Query Fixture", () => {
  it("should emit deepObject query parameter with serialization", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");
    const openapi = generateOpenAPI(controllers, checker);

    const op = manifest.controllers[0].operations.find(o => o.operationId === "PostController_search");
    expect(op).toBeDefined();

    const queryArgs = op?.args.query ?? [];
    expect(queryArgs).toHaveLength(1);
    expect(queryArgs[0].name).toBe("where");
    expect(queryArgs[0].serialization?.style).toBe("deepObject");
    expect(queryArgs[0].serialization?.explode).toBe(true);

    const openApiOp = openapi.paths["/posts/search"]?.get;
    expect(openApiOp).toBeDefined();
    const param = openApiOp?.parameters?.find((p: { name: string }) => p.name === "where");
    expect(param?.style).toBe("deepObject");
    expect(param?.explode).toBe(true);
  });
});
