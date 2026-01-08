import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";

describe("Query Builder Schema Inference", () => {
  it("should detect simple .select() pattern and generate minimal schema", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/query-builder-inference");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    // TestEntity schema should exist
    expect(openapi.components.schemas["TestEntity"]).toBeDefined();

    // The simple endpoint should have a response schema
    const simplePath = openapi.paths["/test-query-builder/simple"];
    expect(simplePath).toBeDefined();
    expect(simplePath.get).toBeDefined();

    const getOperation = simplePath.get;
    const responseSchema = getOperation.responses[200].content["application/json"].schema;

    // Should be wrapped in PaginatedResult
    expect(responseSchema.type).toBe("object");
    expect(responseSchema.properties?.items).toBeDefined();
    expect(responseSchema.properties?.page).toBeDefined();
    expect(responseSchema.properties?.pageSize).toBeDefined();
    expect(responseSchema.properties?.totalItems).toBeDefined();

    // Items should be an array
    const itemsSchema = responseSchema.properties.items as any;
    expect(itemsSchema.type).toBe("array");
    expect(itemsSchema.items).toBeDefined();

    // The item schema should only include selected fields: id, title, status
    const itemSchema = itemsSchema.items;
    expect(itemSchema.type).toBe("object");
    expect(itemSchema.properties).toBeDefined();

    // Check that only selected fields are present
    const props = itemSchema.properties;
    expect(props.id).toBeDefined();
    expect(props.title).toBeDefined();
    expect(props.status).toBeDefined();

    // Check that non-selected fields are NOT present (content should be excluded)
    expect(props.content).toBeUndefined();

    // Check required fields
    if (itemSchema.required) {
      expect(itemSchema.required).toContain("id");
      expect(itemSchema.required).toContain("title");
      expect(itemSchema.required).toContain("status");
    }
  });

  it("should handle .include() for relations", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/query-builder-inference");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const withIncludePath = openapi.paths["/test-query-builder/with-include"];
    const getOperation = withIncludePath.get;
    const responseSchema = getOperation.responses[200].content["application/json"].schema;

    // Items schema should include author relation
    const itemsSchema = responseSchema.properties.items as any;
    const itemSchema = itemsSchema.items;
    const props = itemSchema.properties;

    // Selected fields + included relation should be present
    expect(props.id).toBeDefined();
    expect(props.title).toBeDefined();
    expect(props.author).toBeDefined();
    
    // Non-selected fields should not be present
    expect(props.content).toBeUndefined();
    expect(props.status).toBeUndefined();
  });

  it("should handle variable reassignment pattern", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/query-builder-inference");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const variableReassignmentPath = openapi.paths["/test-query-builder/variable-reassignment"];
    const getOperation = variableReassignmentPath.get;
    const responseSchema = getOperation.responses[200].content["application/json"].schema;

    // Should be wrapped in PaginatedResult
    expect(responseSchema.type).toBe("object");
    expect(responseSchema.properties?.items).toBeDefined();
    expect(responseSchema.properties?.page).toBeDefined();

    // Items schema should include selected fields from all reassignments
    const itemsSchema = responseSchema.properties.items as any;
    const itemSchema = itemsSchema.items;
    const props = itemSchema.properties;

    // Should include id, title, status (from select)
    expect(props.id).toBeDefined();
    expect(props.title).toBeDefined();
    expect(props.status).toBeDefined();

    // Should include author (from include)
    expect(props.author).toBeDefined();

    // Should NOT include non-selected fields
    expect(props.content).toBeUndefined();
    expect(props.category).toBeUndefined();
  });

  it("should handle nested .include() with field selection", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/query-builder-inference");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const nestedPath = openapi.paths["/test-query-builder/nested-include"];
    const getOperation = nestedPath.get;
    const responseSchema = getOperation.responses[200].content["application/json"].schema;

    // Items schema should include nested relations
    const itemsSchema = responseSchema.properties.items as any;
    const itemSchema = itemsSchema.items;
    const props = itemSchema.properties;

    // Should include both author and category relations
    expect(props.author).toBeDefined();
    expect(props.category).toBeDefined();
  });

  it("should fall back to full entity schema when query pattern not detected", () => {
    // This is a basic test - in reality, this would test with a method
    // that doesn't follow the query builder pattern
    // For now, we skip this test since our fixture only has query builder methods
    // TODO: Add a test case with non-query builder method
  });
});