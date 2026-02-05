import { describe, expect, it } from "vitest";
import { createFilterMappings } from "../../src/adapter/metal-orm/index";

describe("createFilterMappings", () => {
  it("creates filter mappings from field definitions", () => {
    const entity = { name: "", email: "", userId: 0 } as const;
    const mappings = createFilterMappings(entity, [
      { queryKey: "nameContains", field: "name", operator: "contains" },
      { queryKey: "emailContains", field: "email", operator: "contains" },
      { queryKey: "userId", field: "userId", operator: "equals" }
    ]);

    expect(mappings.nameContains).toEqual({ field: "name", operator: "contains" });
    expect(mappings.emailContains).toEqual({ field: "email", operator: "contains" });
    expect(mappings.userId).toEqual({ field: "userId", operator: "equals" });
  });

  it("uses equals as default operator", () => {
    const entity = { name: "" } as const;
    const mappings = createFilterMappings(entity, [
      { queryKey: "name", field: "name" }
    ]);

    expect(mappings.name).toEqual({ field: "name", operator: "equals" });
  });
});
