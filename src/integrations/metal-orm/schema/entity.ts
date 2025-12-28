import { optional, v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import { columnToSchema } from './column-map.js';
import { tableDefOf, type EntityCtor } from './tabledef.js';
import type { ColumnDef } from 'metal-orm';

export type EntitySchemaOptions = {
  pick?: readonly string[];
  omit?: readonly string[];
  name?: string;
};

export function entity<T>(Entity: EntityCtor<T>, opts: EntitySchemaOptions = {}): Schema<T> {
  const table = tableDefOf(Entity);
  const pick = opts.pick ? new Set(opts.pick) : null;
  const omit = opts.omit ? new Set(opts.omit) : null;

  const shape: Record<string, Schema<any>> = {};

  for (const [key, column] of Object.entries(table.columns) as [string, ColumnDef][]) {
    if (pick && !pick.has(key)) continue;
    if (omit && omit.has(key)) continue;

    const schema = columnToSchema(column);
    shape[key] = column.notNull ? schema : optional(schema);
  }

  const base = v.object(shape).strict();
  const typed = base as unknown as Schema<T>;
  return opts.name ? v.named(opts.name, typed) : typed;
}

export namespace entity {
  export function array<T>(Entity: EntityCtor<T>, opts: EntitySchemaOptions = {}) {
    return v.array(entity(Entity, opts));
  }
}
