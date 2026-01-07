import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";

describe("Generic Wrapper Type Bug", () => {
  it("should handle multiple instances of same generic wrapper type with different type arguments", () => {
    const fixtureRoot = resolve(__dirname, "../fixtures/paginated-wrapper-bug");
    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const openapi = generateOpenAPI(controllers, checker);

    const paginatedResultSchema = openapi.components.schemas["PaginatedResult"];
    expect(paginatedResultSchema).toBeDefined();
    expect(paginatedResultSchema.properties?.items).toBeDefined();

    const itemsSchema = paginatedResultSchema.properties!.items as any;
    
    // Verify structure: items should be an array with oneOf containing both User and Company
    expect(itemsSchema.type).toBe("array");
    expect(itemsSchema.items).toBeDefined();
    expect(itemsSchema.items?.oneOf).toBeDefined();
    expect(itemsSchema.items?.oneOf).toHaveLength(2);
    
    const refs = itemsSchema.items!.oneOf!.map((item: any) => item.$ref);
    expect(refs).toContain("#/components/schemas/User");
    expect(refs).toContain("#/components/schemas/Company");
    
    // Verify that non-generic properties like page, pageSize, totalItems are single values (not oneOf)
    expect(paginatedResultSchema.properties?.page).toMatchObject({ type: "integer" });
    expect(paginatedResultSchema.properties?.pageSize).toMatchObject({ type: "integer" });
    expect(paginatedResultSchema.properties?.totalItems).toMatchObject({ type: "integer" });
  });
});
