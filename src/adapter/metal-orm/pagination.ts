import type { PaginationConfig, PaginationOptions, ParsedPagination } from "./types";
import { coerce } from "../../core/coerce";

export function parsePagination(
  query: Record<string, unknown>,
  config: PaginationConfig = {}
): ParsedPagination {
  const { defaultPageSize = 25, maxPageSize = 100 } = config;

  const page = coerce.integer(query.page as string | number, {
    min: 1,
    clamp: true
  }) ?? 1;

  const pageSize = coerce.integer(query.pageSize as string | number, {
    min: 1,
    max: maxPageSize,
    clamp: true
  }) ?? defaultPageSize;

  return { page, pageSize };
}
