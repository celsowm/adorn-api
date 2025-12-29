import { getTableDefFromEntity } from 'metal-orm';
import type { EntityConstructor, TableDef } from 'metal-orm';

export type EntityCtor<T = unknown> = new (...args: unknown[]) => T;

export function tableDefOf<T>(Entity: EntityCtor<T>): TableDef {
  const table = getTableDefFromEntity(Entity as EntityConstructor);
  if (!table) {
    const name = Entity.name || 'Entity';
    throw new Error(`Unable to derive MetalORM table definition for ${name}`);
  }
  return table;
}
