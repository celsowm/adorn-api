import { v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import { tableDefOf, type EntityCtor } from './tabledef.js';
import { columnToSchema } from './column-map.js';
import type { HttpPick, Paged } from './types.js';

export type FiltersOptions<const P extends readonly (string & PropertyKey)[]> = {
  pick: P;
  paging?: boolean;
};

export function filtersFromEntity<T, const P extends readonly (keyof T & string)[]>(
  Entity: EntityCtor<T>,
  opts: FiltersOptions<P>,
): Schema<(opts['paging'] extends false ? {} : Paged) & Partial<{ [K in P[number]]: HttpPick<T, K> }>> {
  const table = tableDefOf(Entity);
  const shape: Record<string, Schema<any>> = {};

  if (opts.paging !== false) {
    shape.page = v.number().int().min(1).optional();
    shape.pageSize = v.number().int().min(1).max(100).optional();
  }

  for (const key of opts.pick) {
    const column = (table.columns as Record<string, unknown>)[key as string];
    if (!column) continue;
    shape[key as string] = columnToSchema(column as any).optional();
  }

  const schema = v.object(shape, { strict: true });
  return schema as Schema<(opts['paging'] extends false ? {} : Paged) & Partial<{ [K in P[number]]: HttpPick<T, K> }>>;
}
