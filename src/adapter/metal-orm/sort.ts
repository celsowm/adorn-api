import type { FilterFieldInput, ParseSortOptions, ParsedSort, SortDirection } from "./types";

/**
 * Parses sort parameters from query params using an allowed sortable column map.
 * Returns undefined when no valid sort column is selected.
 */
export function parseSort<T>(
  query: Record<string, unknown> | undefined,
  sortableColumns: Record<string, FilterFieldInput<T>>,
  options?: Omit<ParseSortOptions<T>, "query" | "sortableColumns">
): ParsedSort<T> | undefined;
export function parseSort<T>(options: ParseSortOptions<T>): ParsedSort<T> | undefined;
export function parseSort<T>(
  queryOrOptions: Record<string, unknown> | ParseSortOptions<T> | undefined,
  sortableColumns?: Record<string, FilterFieldInput<T>>,
  options?: Omit<ParseSortOptions<T>, "query" | "sortableColumns">
): ParsedSort<T> | undefined {
  const resolved = sortableColumns
    ? {
        query: queryOrOptions as Record<string, unknown> | undefined,
        sortableColumns,
        ...(options ?? {})
      }
    : (queryOrOptions as ParseSortOptions<T> | undefined);

  const query = resolved?.query;
  const allowed = resolved?.sortableColumns;
  if (!query || !allowed || Object.keys(allowed).length === 0) {
    return undefined;
  }

  const sortByKey = resolved.sortByKey ?? "sortBy";
  const sortDirectionKey = resolved.sortDirectionKey ?? "sortDirection";
  const defaultSortBy = resolved.defaultSortBy;
  const defaultDirection = resolved.defaultSortDirection ?? "asc";

  const requestedSortBy = toTrimmedString(query[sortByKey]);
  const selectedSortBy = selectSortBy(requestedSortBy, defaultSortBy, allowed);
  if (!selectedSortBy) {
    return undefined;
  }

  const requestedDirection = toTrimmedString(query[sortDirectionKey]);
  const sortDirection = normalizeDirection(requestedDirection, defaultDirection);

  return {
    sortBy: selectedSortBy,
    sortDirection,
    field: allowed[selectedSortBy]
  };
}

function toTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function selectSortBy<T>(
  requestedSortBy: string | undefined,
  defaultSortBy: string | undefined,
  allowed: Record<string, FilterFieldInput<T>>
): string | undefined {
  if (requestedSortBy && requestedSortBy in allowed) {
    return requestedSortBy;
  }
  if (defaultSortBy && defaultSortBy in allowed) {
    return defaultSortBy;
  }
  return undefined;
}

function normalizeDirection(
  raw: string | undefined,
  fallback: SortDirection
): SortDirection {
  if (raw === "desc") {
    return "desc";
  }
  if (raw === "asc") {
    return "asc";
  }
  return fallback;
}
