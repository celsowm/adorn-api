import type { PaginationConfig, ParsedPagination } from "./types";
import { coerce } from "../../core/coerce";

/**
 * Parses pagination parameters from query parameters.
 * @param query - Query parameters
 * @param config - Pagination configuration
 * @returns Parsed pagination result
 */
export function parsePagination(
  query: object,
  config: PaginationConfig = {}
): ParsedPagination {
  const { defaultPageSize = 25, maxPageSize = 100 } = config;
  const q = query as Record<string, unknown>;

  const page = coerce.integer(q.page as string | number, {
    min: 1,
    clamp: true
  }) ?? 1;

  const pageSize = coerce.integer(q.pageSize as string | number, {
    min: 1,
    max: maxPageSize,
    clamp: true
  }) ?? defaultPageSize;

  return { page, pageSize };
}
