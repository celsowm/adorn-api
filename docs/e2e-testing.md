# End-to-end testing

Vitest + Supertest are used to exercise the Express APIs and MetalORM integration.

- `test/e2e/metal-orm.adorn-api.spec.ts` verifies the decorator-driven controller setup with a shared `OrmSession` and MetalORM helpers.
- `test/e2e/metal-orm.adorn-api.rest.spec.ts` runs a full REST flow with middleware, route bindings, and session lifecycle (including per-request `OrmSession` creation via `controllerFactory`).
- Additional suites (`users.get.spec.ts`, `users.list.spec.ts`, `users.paged.spec.ts`, `metal-orm.sqlite.spec.ts`, etc.) cover helpers, decorators, and MetalORM transaction behaviors.

Run the full suite with `npm run test` or focus on a subset with `npm run test -- test/e2e/metal-orm.adorn-api.rest.spec.ts`. The tests rely on an in-memory SQLite database, so they run quickly without external services.
