/**
 * Utility functions for applying list queries to Metal ORM query builders.
 * Includes pagination, sorting, and parsing utilities.
 */
import type { ListQuery } from "./listQuery.js";
import type { SelectQueryBuilder } from "metal-orm";
import type { OrmSession } from "metal-orm";
import type { PaginatedResult } from "metal-orm";

/**
 * Applies a list query to a Metal ORM select query builder and executes a paginated query.
 * 
 * @typeParam TEntity - The entity type being queried
 * @param qb - The Metal ORM select query builder
 * @param session - The ORM session to use for execution
 * @param query - Optional list query parameters (pagination, filtering, sorting)
 * @returns A promise resolving to a paginated result
 * 
 * @example
 * ```ts
 * const result = await applyListQuery(
 *   db.selectFrom("users"),
 *   session,
 *   { page: 1, pageSize: 10, where: { name: { eq: "John" } } }
 * );
 * ```
 */
export async function applyListQuery<TEntity extends object>(
  qb: SelectQueryBuilder<TEntity>,
  session: OrmSession,
  query?: ListQuery<TEntity>
): Promise<PaginatedResult<TEntity>> {
  return qb.executePaged(session, pagedOptions(query));
}

/**
 * Generates pagination options with defaults.
 * 
 * @param query - Optional pagination parameters
 * @param query.page - Page number (1-indexed, defaults to 1)
 * @param query.pageSize - Items per page (defaults to 10)
 * @returns Pagination options object
 */
export function pagedOptions(query?: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  return {
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? 10,
  };
}

/**
 * Normalizes sort input into an array of strings.
 * Accepts comma-separated strings or arrays.
 * 
 * @param sort - Sort input (string, array of strings, or undefined)
 * @returns Array of sort field names
 * 
 * @example
 * ```ts
 * normalizeSort("name,-age") // ["name", "-age"]
 * normalizeSort(["name", "-age"]) // ["name", "-age"]
 * ```
 */
export function normalizeSort(sort: unknown): string[] {
  if (Array.isArray(sort)) {
    return sort.flatMap((v) => String(v).split(","));
  }
  if (typeof sort === "string") {
    return sort.split(",");
  }
  return [];
}

/**
 * Sort direction indicator.
 * "ASC" for ascending order, "DESC" for descending order.
 */
export type SortDirection = "ASC" | "DESC";

/**
 * Represents a parsed sort token with direction and field information.
 */
export type SortToken = {
  /** Original sort string */
  raw: string;
  /** Field name without direction prefix */
  field: string;
  /** Dot-separated path for nested fields */
  path: string[];
  /** Sort direction (ASC or DESC) */
  direction: SortDirection;
  /** Whether this field references a relation */
  isRelationField: boolean;
};

/**
 * Options for parsing sort tokens.
 */
export type ParseSortOptions = {
  /** Maximum number of sort tokens to return (default: 20) */
  max?: number;
  /** Whitelist of allowed field paths (supports wildcards like "user.*") */
  whitelist?: string[];
};

function matchWhitelist(path: string[], whitelist: string[]): boolean {
  const pathStr = path.join(".");

  for (const pattern of whitelist) {
    if (pattern === pathStr) return true;

    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (pathStr.startsWith(prefix)) return true;
    }
  }

  return false;
}

/**
 * Parses sort input into structured SortToken objects.
 * 
 * @param sort - Sort input (string, array, or undefined)
 * @param opts - Optional parsing configuration
 * @returns Array of parsed sort tokens
 * 
 * @example
 * ```ts
 * parseSort("name,-age,address.city")
 * // Returns tokens with direction, field, path, and isRelationField
 * ```
 */
export function parseSort(sort: unknown, opts?: ParseSortOptions): SortToken[] {
  const max = opts?.max ?? 20;
  const whitelist = opts?.whitelist;

  const tokens = normalizeSort(sort)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((raw) => {
      const direction: SortDirection = raw.startsWith("-") ? "DESC" : "ASC";
      const field = raw.replace(/^[-+]/, "").trim();
      const path = field.split(".").map((p) => p.trim()).filter(Boolean);

      return {
        raw,
        field,
        path,
        direction,
        isRelationField: path.length > 1,
      };
    })
    .filter((t) => t.field.length > 0);

  if (whitelist && whitelist.length > 0) {
    return tokens.filter((t) => matchWhitelist(t.path, whitelist));
  }

  return tokens;
}
