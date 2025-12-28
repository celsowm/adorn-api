# Adorn API
Adorn API turns TypeScript classes into HTTP controllers with Stage-3 decorators, then wires Express routes, validation, and OpenAPI docs from the same metadata. It stays small and focused while still supporting MetalORM-backed persistence when you want it.

## Why Adorn API
- One source of truth: decorators and schemas drive routing, validation, and OpenAPI.
- Express-native by default, without locking you into a large framework.
- MetalORM helpers keep DTOs, filters, and entities in sync.
- Test-first ergonomics with clear e2e coverage of the runtime wiring.

## Features
- Controller decorators (`@Controller`, `@Get`, `@Post`, etc.) backed by a registry/router that mounts on Express.
- Built-in OpenAPI generator with optional Swagger UI serving through the Express adapter.
- MetalORM helpers (`entityDto`, `filtersFromEntity`, `tableDefOf`) to reuse entity metadata for payload validation and database filtering.
- End-to-end coverage for both direct API handlers and MetalORM REST routes using Vitest + Supertest.

For detailed writeups of each feature, see the companion guides under `docs/`.

## Requirements
- Node.js v18+
- SQLite (only for in-memory tests; runtime persistence is pluggable via MetalORM executors)

## Getting started
1. `npm install` to pull runtime and dev dependencies (Express, MetalORM, Vitest).
2. `npm run build` to compile the TypeScript sources into `dist/`.
3. `npm run test` to run the full Vitest suite (unit + integration/e2e tests).

For quick feedback on a single spec file: `npm run test -- test/e2e/metal-orm.adorn-api.rest.spec.ts`.

## Scripts
- `npm run clean`: removes the `dist` directory.
- `npm run build`: transpiles `src/**/*.ts` via the `tsconfig.build.json` bundle target.
- `npm run typecheck`: runs `tsc` with strict settings against `src` + `test`.
- `npm run check`: runs the decorated-return contract check plus the test suite.
- `npm run test` / `npm run test:e2e`: run the entire Vitest suite or just the e2e directory.

## MetalORM integration
- Controllers create `OrmSession` instances with a shared in-memory SQLite executor for tests.
- DTOs and filter schemas derive directly from `metal-orm` entity definitions via helpers in `src/integrations/metal-orm/schema`.
- The REST controller examples show how to load entities via `selectFromEntity`, update tracked instances, and rely on `OrmSession` flush/commit semantics without manually writing SQL.

Learn more about MetalORM on npm: https://www.npmjs.com/package/metal-orm

## Project layout
- `src/`: exports glue code (`express`, `metal-orm`, validation helpers, adapters).
- `test/e2e/`: Vitest suites exercising the Express and MetalORM API surface.
- `src/types/metal-orm.d.ts`: local type definitions used while the shared MetalORM package upgrades.

## Next steps
1. Add real decorators and metadata for your domain models under `src`.
2. Extend `src/adapters/express` to add middleware or transports as needed.
3. Hook a persistent MetalORM executor when moving beyond the in-memory SQLite setup used in tests.
