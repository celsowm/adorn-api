import { optional, v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import { tableDefOf, type EntityCtor } from './tabledef.js';
import { columnToSchema } from './column-map.js';
import type { HttpPick, Paged } from './types.js';

export type FiltersOptions<P extends readonly (string & PropertyKey)[]> = {
  pick: P;
  paging?: boolean;
};

export function filtersFromEntity<
  T,
  const P extends readonly (keyof T & string)[],
  const Opts extends FiltersOptions<P>,
>(
  Entity: EntityCtor<T>,
  opts: Opts,
): Schema<(Opts['paging'] extends false ? {} : Paged) & Partial<{ [K in P[number]]: HttpPick<T, K> }>> {
  const table = tableDefOf(Entity);
  const shape: Record<string, Schema<any>> = {};

  if (opts.paging !== false) {
    shape.page = v.number().int().min(1).optional();
    shape.pageSize = v.number().int().min(1).max(100).optional();
  }

  for (const key of opts.pick) {
    const column = (table.columns as Record<string, unknown>)[key as string];
    if (!column) continue;
    shape[key as string] = optional(columnToSchema(column as any));
  }

  const schema = v.object(shape).strict();
  return schema as Schema<(Opts['paging'] extends false ? {} : Paged) & Partial<{ [K in P[number]]: HttpPick<T, K> }>>;
}
