# MetalORM integration

The repo demonstrates how to wire MetalORM into controller-based handlers:

- `src/integrations/metal-orm/schema` exposes helpers like `entityDto`, `filtersFromEntity`, and `tableDefOf` to derive validation/filter schemas from the same decorated entity metadata the ORM uses.
- Controllers persist entities with `OrmSession` reusing `createSqliteExecutor` for an in‑memory SQLite database (`test/e2e/metal-orm.adorn-api.rest.spec.ts` uses the executor to build `OrmContext` containing `db`, `orm`, and `executor`).
- Queries flow through `selectFromEntity`, `entityRef`, and filtered `qb.where(eq(...))` (see both REST and adapter tests). Mutations rely on `session.persist`, `session.commit`, plus the implicit tracking provided by `OrmSession.markDirty`/`markRemoved` instead of manual SQL.

If you swap out the executor with a persistent client, keep in mind that the ORM already handles transactions, flush hooks, and relation tracking, so your controllers only need to `persist`, mutate tracked entities, and `commit`.
