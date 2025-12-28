import { v } from '../../../validation/native/schema';
import type { Schema } from '../../../validation/native/schema';
import { tableDefOf, type EntityCtor } from './tabledef';
import { columnToSchema } from './column-map';
import type { ColumnDef, SaveGraphInputPayload } from 'metal-orm';

export type DtoMode = 'create' | 'update';

function shouldSkipColumnForCreate(column: ColumnDef): boolean {
  return Boolean(column.autoIncrement || column.generated);
}

function isRequiredForCreate(column: ColumnDef): boolean {
  if (!column.notNull) return false;
  if (column.default !== undefined) return false;
  if (column.autoIncrement || column.generated) return false;
  return true;
}

export function entityDto<T>(Entity: EntityCtor<T>, mode: 'create'): Schema<SaveGraphInputPayload<T>>;
export function entityDto<T>(Entity: EntityCtor<T>, mode: 'update'): Schema<Partial<SaveGraphInputPayload<T>>>;
export function entityDto<T>(Entity: EntityCtor<T>, mode: DtoMode): Schema<any> {
  const table = tableDefOf(Entity);
  const shape: Record<string, Schema<any>> = {};

  for (const [key, column] of Object.entries(table.columns) as [string, ColumnDef][]) {
    const schema = columnToSchema(column);
    if (mode === 'create' && shouldSkipColumnForCreate(column)) {
      continue;
    }

    if (mode === 'update') {
      shape[key] = schema.optional();
      continue;
    }

    const required = isRequiredForCreate(column);
    shape[key] = required ? schema : schema.optional();
  }

  const base = v.object(shape, { strict: true });
  return mode === 'update' ? v.partial(base) : base;
}
