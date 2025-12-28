import { describe, expect, it } from 'vitest';
import { bootstrapEntities, col, Column, Entity, PrimaryKey } from 'metal-orm';
import { entityDto, filtersFromEntity, tableDefOf } from '../../src/metal-orm.js';
import type { ValidationResult } from '../../src/contracts/validator.js';

@Entity()
class Product {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(100)))
  name!: string;

  @Column(col.varchar(255))
  description!: string;

  @Column(col.int())
  published!: number;
}

bootstrapEntities();

function expectIssues<T>(result: ValidationResult<T>) {
  if (result.ok) {
    throw new Error('Expected validation failure');
  }
  return result.issues;
}

describe('MetalORM schema helpers', () => {
  it('derives table metadata and notifies when classes lack entity metadata', () => {
    const table = tableDefOf(Product);

    expect(table.columns.name).toBeDefined();
    expect(table.columns.id.autoIncrement).toBe(true);

    class MissingEntity {}

    expect(() => tableDefOf(MissingEntity)).toThrowError(
      /Unable to derive MetalORM table definition/,
    );
  });

  it('builds create/update DTOs that honor not-null constraints', () => {
    const createSchema = entityDto(Product, 'create');
    const validCreate = createSchema.parse({ name: 'Gizmo' });
    expect(validCreate.ok).toBe(true);

    const missingName = createSchema.parse({});
    expect(missingName.ok).toBe(false);
    expect(expectIssues(missingName)[0].path).toEqual(['name']);

    const updateSchema = entityDto(Product, 'update');
    const emptyUpdate = updateSchema.parse({});
    expect(emptyUpdate.ok).toBe(true);

    const invalidUpdate = updateSchema.parse({ id: 'string' as unknown as number });
    expect(invalidUpdate.ok).toBe(false);
    expect(expectIssues(invalidUpdate)[0].path).toEqual(['id']);
  });

  it('produces filter schemas with paging checks and optional columns', () => {
    const filterSchema = filtersFromEntity(Product, { pick: ['id', 'name'] as const });

    const ok = filterSchema.parse({ id: 2, page: 1, pageSize: 5 });
    expect(ok.ok).toBe(true);

    const missingPage = filterSchema.parse({ page: 0 });
    expect(missingPage.ok).toBe(false);
    expect(expectIssues(missingPage)[0]).toMatchObject({ path: ['page'], code: 'too_small' });
  });
});
