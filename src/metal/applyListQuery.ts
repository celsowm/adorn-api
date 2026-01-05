import type { ListQuery } from "./listQuery.js";
import type { SelectQueryBuilder } from "metal-orm";
import type { OrmSession } from "metal-orm";
import type { PaginatedResult } from "metal-orm";

export async function applyListQuery<TEntity extends object>(
  qb: SelectQueryBuilder<TEntity>,
  session: OrmSession,
  query?: ListQuery<TEntity>
): Promise<PaginatedResult<TEntity>> {
  const page = query?.page ?? 1;
  const pageSize = query?.pageSize ?? 10;
  
  return qb.executePaged(session, { page, pageSize });
}

export function normalizeSort(sort: unknown): string[] {
  if (Array.isArray(sort)) {
    return sort.map(s => String(s));
  }
  if (typeof sort === "string") {
    return sort.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}
