import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";
import { calculateSchemaComplexity } from "../../src/compiler/schema/partitioner.js";

describe("Circular Reference Bug Fix", () => {
  it("should not throw error when serializing schemas with ManyToManyCollection", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/circular-reference-bug");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths["/courses/{id}"]).toBeDefined();
    expect(openapi.paths["/courses/{id}"]["get"]).toBeDefined();

    const schemas = openapi.components.schemas;
    expect(Object.keys(schemas).length).toBeGreaterThan(0);

    for (const schemaName of Object.keys(schemas)) {
      const schema = schemas[schemaName];
      
      expect(() => {
        JSON.stringify(schema);
      }).not.toThrow();
    }
  });

  it("should calculate schema complexity without circular reference errors", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/circular-reference-bug");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const schemas = openapi.components.schemas;

    for (const schemaName of Object.keys(schemas)) {
      const schema = schemas[schemaName];
      
      expect(() => {
        calculateSchemaComplexity(schema);
      }).not.toThrow();
    }
  });

  it("should store pivot as string in x-metal-orm-rel metadata", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/circular-reference-bug");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const schemas = openapi.components.schemas;

    for (const schemaName of Object.keys(schemas)) {
      const schema = schemas[schemaName];

      const findCircularRefInSchema = (obj: any): boolean => {
        if (typeof obj !== "object" || obj === null) {
          return false;
        }

        if (obj["x-metal-orm-rel"]) {
          const rel = obj["x-metal-orm-rel"];
          if (rel.pivot) {
            expect(typeof rel.pivot).toBe("string");
            expect(rel.pivot).not.toHaveProperty("immediateBaseConstraint");
            return true;
          }
        }

        for (const value of Object.values(obj)) {
          if (findCircularRefInSchema(value)) {
            return true;
          }
        }

        return false;
      };

      findCircularRefInSchema(schema);
    }
  });
});
