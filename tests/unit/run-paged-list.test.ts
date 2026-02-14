import { beforeEach, describe, expect, it, vi } from "vitest";
import { col, defineTable } from "metal-orm";

const { executeFilteredPagedMock } = vi.hoisted(() => ({
  executeFilteredPagedMock: vi.fn()
}));

vi.mock("metal-orm", async () => {
  const actual = await vi.importActual<typeof import("metal-orm")>("metal-orm");
  return {
    ...actual,
    executeFilteredPaged: executeFilteredPagedMock
  };
});

import { runPagedList } from "../../src/adapter/metal-orm/list";

describe("runPagedList", () => {
  const users = defineTable("users", {
    id: col.primaryKey(col.autoIncrement(col.int())),
    name: col.notNull(col.text()),
    email: col.notNull(col.text())
  });

  const qb = {
    getTable: () => users
  } as unknown as import("metal-orm").SelectQueryBuilder<
    { id: number; name: string; email: string },
    typeof users
  >;

  beforeEach(() => {
    executeFilteredPagedMock.mockReset();
    executeFilteredPagedMock.mockResolvedValue({
      items: [],
      totalItems: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false
    });
  });

  it("combines parsing and forwards normalized sort from sortOrder", async () => {
    await runPagedList({
      query: {
        page: "2",
        pageSize: "10",
        nameContains: "Ada",
        sortBy: "name",
        sortOrder: "DESC"
      },
      target: users,
      qb,
      session: {} as import("metal-orm").OrmSession,
      filterMappings: {
        nameContains: { field: "name", operator: "contains" }
      },
      sortableColumns: {
        name: "name",
        email: "email"
      },
      defaultSortBy: "email",
      defaultSortDirection: "asc"
    });

    expect(executeFilteredPagedMock).toHaveBeenCalledTimes(1);
    expect(executeFilteredPagedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        filters: {
          name: { contains: "Ada" }
        },
        sortBy: "name",
        sortDirection: "DESC",
        defaultSortBy: undefined,
        defaultSortDirection: "ASC"
      })
    );
  });

  it("ignores unresolved sortable path and keeps helper execution safe", async () => {
    await runPagedList({
      query: {
        sortBy: "deepField"
      },
      target: users,
      qb,
      session: {} as import("metal-orm").OrmSession,
      filterMappings: {},
      sortableColumns: {
        deepField: "profile.some.name"
      },
      defaultSortBy: "deepField",
      defaultSortDirection: "desc"
    });

    expect(executeFilteredPagedMock).toHaveBeenCalledTimes(1);
    expect(executeFilteredPagedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: undefined,
        defaultSortBy: undefined,
        defaultSortDirection: "DESC"
      })
    );
  });
});
