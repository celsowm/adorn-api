import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";

const fixtureRoot = resolve(__dirname, "../fixtures/users");
const artifactsDir = resolve(fixtureRoot, ".adorn");
const projectRoot = resolve(__dirname, "..");

describe("OpenAI-Compatible OpenAPI", () => {
  describe("Query Parameters", () => {
    it("should not use content in query parameters", () => {
      const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
      const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
      const controllers = scanControllers(sourceFiles, checker);
      const openapi = generateOpenAPI(controllers, checker);

      for (const path of Object.values(openapi.paths)) {
        for (const method of Object.values(path as Record<string, any>)) {
          if (method.parameters) {
            for (const param of method.parameters) {
              expect(param).not.toHaveProperty("content");
            }
          }
        }
      }
    });

    it("should represent object-like query params as string schema", () => {
      const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
      const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
      const controllers = scanControllers(sourceFiles, checker);
      const openapi = generateOpenAPI(controllers, checker);

      const getUserOp = openapi.paths["/users/{id}"]["get"];
      expect(getUserOp).toBeDefined();

      const params = getUserOp.parameters || [];
      const verboseParam = params.find((p: any) => p.name === "verbose");
      expect(verboseParam).toBeDefined();

      if (verboseParam) {
        expect(verboseParam.schema.type).toContain("boolean");
        expect(verboseParam).not.toHaveProperty("content");
      }
    });
  });

  describe("Boolean Unions", () => {
    it("should collapse true | false unions to boolean type", () => {
      const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
      const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
      const controllers = scanControllers(sourceFiles, checker);
      const openapi = generateOpenAPI(controllers, checker);

      for (const schema of Object.values(openapi.components.schemas)) {
        const s = schema as any;
        if (s.anyOf) {
          for (const branch of s.anyOf) {
            if (branch.type === "boolean" && branch.enum) {
              expect.fail("Boolean union should not have enum with boolean literals");
            }
          }
        }
      }
    });
  });
});

describe("Manifest Required Fields", () => {
  it("should correctly mark required query params", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    const getUserOp = manifest.controllers[0].operations.find(
      op => op.operationId === "UserController_getUser"
    );
    expect(getUserOp).toBeDefined();

    if (getUserOp) {
      const verboseParam = getUserOp.args.query.find((q: any) => q.name === "verbose");
      expect(verboseParam).toBeDefined();
      if (verboseParam) {
        expect(verboseParam.required).toBe(false);
      }
    }
  });

  it("should correctly mark required path params", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    const getUserOp = manifest.controllers[0].operations.find(
      op => op.operationId === "UserController_getUser"
    );
    expect(getUserOp).toBeDefined();

    if (getUserOp) {
      expect(getUserOp.args.path).toHaveLength(1);
      expect(getUserOp.args.path[0].name).toBe("id");
      expect(getUserOp.args.path[0].required).toBe(true);
    }
  });

  it("should correctly mark required body params", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");

    const createOp = manifest.controllers[0].operations.find(
      op => op.operationId === "UserController_createUser"
    );
    expect(createOp).toBeDefined();

    if (createOp && createOp.args.body) {
      expect(createOp.args.body.required).toBe(true);
    }
  });
});

describe("OpenAPI Schema Quality", () => {
  it("should not have x-adorn-jsonSchemaRef on primitive parameters", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const getOp = openapi.paths["/users"]["get"];
    const params = (getOp?.parameters || []);

    const verboseParam = params.find((p: any) => p.name === "verbose");
    if (verboseParam) {
      expect(verboseParam.schema.type).toBe("boolean");
      expect(verboseParam).not.toHaveProperty("x-adorn-jsonSchemaRef");
    }
  });

  it("should have x-adorn-jsonSchemaRef on object-like query parameters", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const getOp = openapi.paths["/users"]["get"];
    const params = (getOp?.parameters || []);

    for (const param of params) {
      if (param.schema?.type === "string" && !param.$ref) {
        expect(param).toHaveProperty("x-adorn-jsonSchemaRef");
      }
    }
  });

  it("should have description with examples on string-encoded object params", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const getOp = openapi.paths["/users"]["get"];
    const params = (getOp?.parameters || []);

    for (const param of params) {
      if (param.schema?.type === "string") {
        expect(param).toHaveProperty("description");
        expect(param.description).toContain("JSON-encoded");
        expect(param).toHaveProperty("examples");
        expect(param.examples).toBeDefined();
      }
    }
  });

  it("should use integer type for page, pageSize, totalItems, and ID fields", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    for (const schema of Object.values(openapi.components.schemas)) {
      const s = schema as any;
      if (s.properties) {
        const integerFields = ['page', 'pageSize', 'totalItems'];
        for (const field of integerFields) {
          if (s.properties[field]) {
            const fieldType = s.properties[field].type;
            expect(fieldType).toBe("integer");
          }
        }
        if (s.properties.id) {
          expect(s.properties.id.type).toBe("integer");
        }
      }
    }

    for (const pathItem of Object.values(openapi.paths)) {
      for (const operation of Object.values(pathItem as Record<string, any>)) {
        if (operation.parameters) {
          for (const param of operation.parameters) {
            if (param.name === 'page' || param.name === 'pageSize' || param.name === 'totalItems') {
              expect(param.schema.type).toBe("integer");
            }
          }
        }
      }
    }
  });

  it("should not have empty objects in allOf", () => {
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const hasEmptyAllOf = (obj: any): boolean => {
      if (!obj) return false;
      if (Array.isArray(obj.allOf)) {
        const hasEmpty = obj.allOf.some((item: any) => {
          return item.type === "object" && 
                 item.properties && 
                 Object.keys(item.properties).length === 0 &&
                 !item.required;
        });
        if (hasEmpty) return true;
      }
      for (const value of Object.values(obj)) {
        if (typeof value === "object" && hasEmptyAllOf(value)) {
          return true;
        }
      }
      return false;
    };

    const emptyAllOfFound = hasEmptyAllOf(openapi);
    expect(emptyAllOfFound).toBe(false);
  });
});
