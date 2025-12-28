import { v } from '../../../validation/native/schema';
import type { Schema } from '../../../validation/native/schema';
import { columnToSchema, isRequiredColumn } from './column-map';
import { tableDefOf, type EntityCtor } from './tabledef';
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
    shape[key] = column.notNull ? schema : schema.optional();
  }

  const base = v.object(shape, { strict: true });
  return opts.name ? v.named(opts.name, base) : (base as Schema<T>);
}

export namespace entity {
  export function array<T>(Entity: EntityCtor<T>, opts: EntitySchemaOptions = {}) {
    return v.array(entity(Entity, opts));
  }
}
