import { optional, v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import { tableDefOf, type EntityCtor } from './tabledef.js';
import { columnToSchema } from './column-map.js';
import type { ColumnDef, SaveGraphInputPayload } from 'metal-orm';

export type DtoMode = 'create' | 'update';

export type EntityDtoSchema<T, Mode extends DtoMode> =
  Mode extends 'create'
    ? Schema<SaveGraphInputPayload<T>>
    : Schema<Partial<SaveGraphInputPayload<T>>>;

function shouldSkipColumnForCreate(column: ColumnDef): boolean {
  return Boolean(column.autoIncrement || column.generated);
}

function isRequiredForCreate(column: ColumnDef): boolean {
  if (!column.notNull) return false;
  if (column.default !== undefined) return false;
  if (column.autoIncrement || column.generated) return false;
  return true;
}

export function entityDto<T, Mode extends DtoMode>(
  Entity: EntityCtor<T>,
  mode: Mode,
): EntityDtoSchema<T, Mode> {
  const table = tableDefOf(Entity);
  const shape: Record<string, Schema<unknown>> = {};

  for (const [key, column] of Object.entries(table.columns) as [string, ColumnDef][]) {
    const schema = columnToSchema(column);
    if (mode === 'create' && shouldSkipColumnForCreate(column)) {
      continue;
    }

    if (mode === 'update') {
      shape[key] = optional(schema);
      continue;
    }

    const required = isRequiredForCreate(column);
    shape[key] = required ? schema : optional(schema);
  }

  const base = v.object(shape).strict();
  return base as EntityDtoSchema<T, Mode>;
}
