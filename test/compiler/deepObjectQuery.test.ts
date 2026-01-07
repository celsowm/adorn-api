import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";

const fixtureRoot = resolve(__dirname, "../fixtures/blog-platform-metal-orm");

describe("DeepObject Query Parameters - Compiler", () => {
  it("should generate OpenAPI with deepObject style for object query params", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/blog-posts"]).toBeDefined();
    expect(openapi.paths["/blog-posts"]["get"]).toBeDefined();

    const getOperation = openapi.paths["/blog-posts"]["get"];
    expect(getOperation.parameters).toBeDefined();

    const whereParam = getOperation.parameters?.find((p: any) => p.name === "where");
    expect(whereParam).toBeDefined();
    expect(whereParam).toMatchObject({
      name: "where",
      in: "query",
      required: false,
      style: "deepObject",
      explode: true,
    });
    expect(whereParam.schema).toBeDefined();
    expect(whereParam.schema.type).toBe("object");
    expect(whereParam.schema.properties).toBeDefined();
  });

  it("should generate manifest with serialization for deepObject params", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.controllers).toHaveLength(1);

    const controller = manifest.controllers[0];
    expect(controller.controllerId).toBe("BlogPostsController");

    const getPostsOp = controller.operations.find(op => op.operationId === "BlogPostsController_getPosts");
    expect(getPostsOp).toBeDefined();

    const whereArg = getPostsOp?.args.query.find(q => q.name === "where");
    expect(whereArg).toBeDefined();
    expect(whereArg).toMatchObject({
      name: "where",
      required: false,
      serialization: { style: "deepObject", explode: true },
    });
    expect(whereArg?.content).toBeUndefined();
  });

  it("should handle simple query params without serialization", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const getOperation = openapi.paths["/blog-posts"]["get"];
    const pageParam = getOperation.parameters?.find((p: any) => p.name === "page");
    
    expect(pageParam).toBeDefined();
    expect(pageParam).toMatchObject({
      name: "page",
      in: "query",
      required: false,
    });
    expect(pageParam.style).toBeUndefined();
    expect(pageParam.explode).toBeUndefined();
  });

  it("should correctly identify object schemas as deepObject candidates", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const getOperation = openapi.paths["/blog-posts"]["get"];
    const whereParam = getOperation.parameters?.find((p: any) => p.name === "where");
    
    expect(whereParam?.schema).toBeDefined();
    expect(whereParam?.schema.type).toBe("object");
    expect(whereParam?.schema.properties).toBeDefined();
    expect(whereParam?.style).toBe("deepObject");
    expect(whereParam?.explode).toBe(true);
  });

  it("should generate correct operationId", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    const ops = manifest.controllers[0].operations;
    expect(ops.find(op => op.operationId === "BlogPostsController_getPosts")).toBeDefined();
  });
});
