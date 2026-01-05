import type { ListQuery } from "./listQuery.js";
import type { SelectQueryBuilder } from "metal-orm";
import type { OrmSession } from "metal-orm";
import type { PaginatedResult } from "metal-orm";

export async function applyListQuery<TEntity extends object>(
  qb: SelectQueryBuilder<TEntity>,
  session: OrmSession,
  query?: ListQuery<TEntity>
): Promise<PaginatedResult<TEntity>> {
  return qb.executePaged(session, pagedOptions(query));
}

export function pagedOptions(query?: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  return {
    page: query?.page ?? 1,
    pageSize: query?.pageSize ?? 10,
  };
}

export function normalizeSort(sort: unknown): string[] {
  if (Array.isArray(sort)) {
    return sort.flatMap((v) => String(v).split(","));
  }
  if (typeof sort === "string") {
    return sort.split(",");
  }
  return [];
}

export type SortDirection = "ASC" | "DESC";

export type SortToken = {
  raw: string;
  field: string;
  path: string[];
  direction: SortDirection;
  isRelationField: boolean;
};

export type ParseSortOptions = {
  max?: number;
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
