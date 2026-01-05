import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";

const fixtureRoot = resolve(__dirname, "../fixtures/users");

describe("Compiler Introspection", () => {
  it("should scan controllers from TypeScript source", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);

    expect(controllers).toHaveLength(1);
    expect(controllers[0].className).toBe("UserController");
    expect(controllers[0].basePath).toBe("/users");
    expect(controllers[0].operations).toHaveLength(3);
  });

  it("should generate OpenAPI with correct schemas", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/users"]).toBeDefined();
    expect(openapi.paths["/users"]["get"]).toBeDefined();
    expect(openapi.paths["/users"]["post"]).toBeDefined();
    expect(openapi.paths["/users/{id}"]).toBeDefined();
    expect(openapi.paths["/users/{id}"]["get"]).toBeDefined();

    expect(openapi.components.schemas["UserDto"]).toBeDefined();
    expect(openapi.components.schemas["CreateUserPayload"]).toBeDefined();

    const userDtoSchema = openapi.components.schemas["UserDto"];
    expect(userDtoSchema.properties?.phone.type).toContain("null");

    expect(userDtoSchema.properties?.role.enum).toEqual(["admin", "user"]);

    const createSchema = openapi.components.schemas["CreateUserPayload"];
    expect(createSchema.properties?.joinedAt.type).toBe("string");
    expect(createSchema.properties?.joinedAt.format).toBe("date-time");
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
    expect(ops.find(op => op.operationId === "UserController_getUser")).toBeDefined();
    expect(ops.find(op => op.operationId === "UserController_createUser")).toBeDefined();

    const createOp = ops.find(op => op.operationId === "UserController_createUser")!;
    expect(createOp.args.body).not.toBeNull();
    expect(createOp.args.body?.index).toBe(0);
    expect(createOp.args.body?.required).toBe(true);

    const getUserOp = ops.find(op => op.operationId === "UserController_getUser")!;
    expect(getUserOp.args.path).toHaveLength(1);
    expect(getUserOp.args.path[0].name).toBe("id");
    expect(getUserOp.args.query).toHaveLength(1);
    expect(getUserOp.args.query[0].name).toBe("verbose");
  });
});
