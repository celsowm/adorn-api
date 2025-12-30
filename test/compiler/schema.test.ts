import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";

const fixtureRoot = resolve(__dirname, "../fixtures/users");

beforeAll(() => {
  execSync("npm run build", { cwd: resolve(__dirname, "../.."), stdio: "inherit" });
});

describe("Compiler Introspection", () => {
  it("should scan controllers from TypeScript source", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);

    expect(controllers).toHaveLength(1);
    expect(controllers[0].className).toBe("UserController");
    expect(controllers[0].basePath).toBe("/users");
    expect(controllers[0].operations).toHaveLength(2);
  });

  it("should generate OpenAPI with correct schemas", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/users/"]).toBeDefined();
    expect(openapi.paths["/users/"]["get"]).toBeDefined();
    expect(openapi.paths["/users/"]["post"]).toBeDefined();

    expect(openapi.components.schemas["UserDto"]).toBeDefined();
    expect(openapi.components.schemas["CreateUserPayload"]).toBeDefined();

    const userDtoSchema = openapi.components.schemas["UserDto"];
    expect(userDtoSchema.properties?.phone.type).toContain("null");

    expect(userDtoSchema.properties?.role.enum).toEqual(["admin", "user"]);
  });

  it("should generate manifest with correct operationIds", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.controllers).toHaveLength(1);

    const ops = manifest.controllers[0].operations;
    expect(ops.find(op => op.operationId === "UserController_getUsers")).toBeDefined();
    expect(ops.find(op => op.operationId === "UserController_createUser")).toBeDefined();

    const createOp = ops.find(op => op.operationId === "UserController_createUser")!;
    expect(createOp.args.body).not.toBeNull();
    expect(createOp.args.body?.index).toBe(0);
    expect(createOp.args.body?.required).toBe(true);
  });
});
