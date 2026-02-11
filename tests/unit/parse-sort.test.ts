import { describe, expect, it } from "vitest";
import { parseSort } from "../../src/adapter/metal-orm/index";

describe("parseSort", () => {
  it("returns undefined when sortBy is missing", () => {
    const result = parseSort({
      query: { page: 1 },
      sortableColumns: { name: "name" }
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when sortBy is not allowed", () => {
    const result = parseSort({
      query: { sortBy: "email" },
      sortableColumns: { name: "name" }
    });
    expect(result).toBeUndefined();
  });

  it("parses valid sort and resolves mapped field", () => {
    const result = parseSort({
      query: { sortBy: "userName", sortDirection: "desc" },
      sortableColumns: { userName: "name" }
    });
    expect(result).toEqual({
      sortBy: "userName",
      sortDirection: "desc",
      field: "name"
    });
  });

  it("supports custom sort keys and defaults", () => {
    const result = parseSort({
      query: { direction: "desc" },
      sortableColumns: { createdAt: "createdAt" },
      sortByKey: "orderBy",
      sortDirectionKey: "direction",
      defaultSortBy: "createdAt",
      defaultSortDirection: "asc"
    });
    expect(result).toEqual({
      sortBy: "createdAt",
      sortDirection: "desc",
      field: "createdAt"
    });
  });
});
