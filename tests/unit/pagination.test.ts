import { describe, expect, it } from "vitest";
import { parsePagination } from "../../src/adapter/metal-orm/index";

describe("parsePagination", () => {
  it("uses defaults when no query provided", () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("applies custom defaults", () => {
    const result = parsePagination({}, { defaultPageSize: 50, maxPageSize: 200 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("parses page and pageSize from query", () => {
    const result = parsePagination({ page: "2", pageSize: "10" });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it("clamps pageSize to max", () => {
    const result = parsePagination({ pageSize: "150" }, { maxPageSize: 100 });
    expect(result.pageSize).toBe(100);
  });

  it("clamps page to min of 1", () => {
    const result = parsePagination({ page: "0" });
    expect(result.page).toBe(1);
  });

  it("handles invalid values as defaults", () => {
    const result = parsePagination({ page: "invalid", pageSize: "not-a-number" });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });
});
