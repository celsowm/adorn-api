import {
  executeFilteredPaged,
  type PagedResponse,
  type SelectQueryBuilder,
  type TableDef
} from "metal-orm";
import { parseFilter } from "./filters";
import { parsePagination } from "./pagination";
import { parseSort } from "./sort";
import type {
  CrudListSortTerm,
  ExecuteCrudListOptions,
  FilterFieldInput,
  RunPagedListOptions,
  SortDirection
} from "./types";

/**
 * Runs a unified filtered/sorted/paginated list query for metal-orm.
 */
export async function runPagedList<
  TResult,
  TTable extends TableDef = TableDef,
  TTarget = unknown,
  TFilterTarget = Record<string, unknown>
>(
  options: RunPagedListOptions<TResult, TTable, TTarget, TFilterTarget>
): Promise<PagedResponse<TResult>> {
  const query = options.query ?? {};
  const qb = resolveQueryBuilder(options.qb);

  const { page, pageSize } = parsePagination(query, {
    defaultPageSize: options.defaultPageSize,
    maxPageSize: options.maxPageSize
  });

  const filters = parseFilter(query, options.filterMappings);
  const parsedSort = parseSort(query, options.sortableColumns, {
    defaultSortBy: options.defaultSortBy,
    defaultSortDirection: options.defaultSortDirection,
    sortByKey: options.sortByKey,
    sortDirectionKey: options.sortDirectionKey,
    sortOrderKey: options.sortOrderKey
  });

  const inferredSortColumns = inferAllowedSortColumns(
    qb.getTable(),
    options.sortableColumns
  );
  const allowedSortColumns = {
    ...inferredSortColumns,
    ...(options.allowedSortColumns ?? {})
  };

  const sortBy =
    parsedSort?.sortBy && parsedSort.sortBy in allowedSortColumns
      ? parsedSort.sortBy
      : undefined;

  const defaultSortBy =
    !sortBy && options.defaultSortBy && options.defaultSortBy in allowedSortColumns
      ? options.defaultSortBy
      : undefined;

  return executeFilteredPaged({
    qb,
    tableOrEntity: options.target as any,
    session: options.session,
    page,
    pageSize,
    filters: filters as any,
    sortBy,
    sortDirection: toOrderDirection(parsedSort?.sortDirection),
    allowedSortColumns: Object.keys(allowedSortColumns).length
      ? allowedSortColumns
      : undefined,
    defaultSortBy,
    defaultSortDirection: toOrderDirection(options.defaultSortDirection),
    tieBreakerColumn: options.tieBreakerColumn
  } as any) as Promise<PagedResponse<TResult>>;
}

/**
 * Alias for runPagedList.
 */
export const executeCrudList = runPagedList;

function resolveQueryBuilder<TResult, TTable extends TableDef>(
  qbOrFactory:
    | SelectQueryBuilder<TResult, TTable>
    | (() => SelectQueryBuilder<TResult, TTable>)
): SelectQueryBuilder<TResult, TTable> {
  return typeof qbOrFactory === "function" ? qbOrFactory() : qbOrFactory;
}

function inferAllowedSortColumns<TFilterTarget>(
  table: TableDef,
  sortableColumns: Record<string, FilterFieldInput<TFilterTarget>>
): Record<string, CrudListSortTerm> {
  const output: Record<string, CrudListSortTerm> = {};

  for (const [queryKey, field] of Object.entries(sortableColumns)) {
    const columnName = toSortableColumnName(field);
    if (!columnName) {
      continue;
    }

    const column = resolveTableColumn(table, columnName);
    if (!column) {
      continue;
    }

    output[queryKey] = column;
  }

  return output;
}

function toSortableColumnName(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      return undefined;
    }
    const segment = String(value[0]).trim();
    return segment.length > 0 ? segment : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const path = value
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (path.length !== 1) {
    return undefined;
  }

  return path[0];
}

function resolveTableColumn(table: TableDef, name: string): CrudListSortTerm | undefined {
  const byKey = table.columns[name];
  if (byKey) {
    return byKey;
  }

  return Object.values(table.columns).find((column) => column.name === name);
}

function toOrderDirection(
  direction: SortDirection | undefined
): "ASC" | "DESC" | undefined {
  if (direction === "desc") {
    return "DESC";
  }
  if (direction === "asc") {
    return "ASC";
  }
  return undefined;
}

export type {
  ExecuteCrudListOptions,
  RunPagedListOptions
};
