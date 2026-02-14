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

  it("parses sortOrder with uppercase DESC", () => {
    const result = parseSort({
      query: { sortBy: "name", sortOrder: "DESC" },
      sortableColumns: { name: "name" }
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "desc",
      field: "name"
    });
  });

  it("parses sortOrder with uppercase ASC", () => {
    const result = parseSort({
      query: { sortBy: "name", sortOrder: "ASC" },
      sortableColumns: { name: "name" }
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "asc",
      field: "name"
    });
  });

  it("gives sortDirection precedence over sortOrder when both present", () => {
    const result = parseSort({
      query: { sortBy: "name", sortDirection: "asc", sortOrder: "DESC" },
      sortableColumns: { name: "name" }
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "asc",
      field: "name"
    });
  });

  it("falls back to sortOrder when sortDirection is absent", () => {
    const result = parseSort({
      query: { sortBy: "name", sortOrder: "desc" },
      sortableColumns: { name: "name" }
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "desc",
      field: "name"
    });
  });

  it("falls back to default when neither sortDirection nor sortOrder present", () => {
    const result = parseSort({
      query: { sortBy: "name" },
      sortableColumns: { name: "name" },
      defaultSortDirection: "desc"
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "desc",
      field: "name"
    });
  });

  it("supports custom sortOrderKey", () => {
    const result = parseSort({
      query: { sortBy: "name", order: "DESC" },
      sortableColumns: { name: "name" },
      sortOrderKey: "order"
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "desc",
      field: "name"
    });
  });

  it("ignores invalid sortOrder values and uses default", () => {
    const result = parseSort({
      query: { sortBy: "name", sortOrder: "INVALID" },
      sortableColumns: { name: "name" },
      defaultSortDirection: "asc"
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "asc",
      field: "name"
    });
  });

  it("normalizes mixed-case sortDirection (e.g. Desc)", () => {
    const result = parseSort({
      query: { sortBy: "name", sortDirection: "Desc" },
      sortableColumns: { name: "name" }
    });
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "desc",
      field: "name"
    });
  });

  it("works with positional args and sortOrder fallback", () => {
    const result = parseSort(
      { sortBy: "name", sortOrder: "DESC" },
      { name: "name" }
    );
    expect(result).toEqual({
      sortBy: "name",
      sortDirection: "desc",
      field: "name"
    });
  });
});
