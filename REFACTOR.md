Below is a ready-to-paste **prompt for an AI refactor agent** to fully restructure the codebase you sent (the merged `sources-js-ts.txt`) into something production-usable for a **backend-only Node service** (CRUD + non-CRUD, dozens of SQL Server tables), with a strong bias toward **codegen-only** and **no legacy decorators**.

---

## Prompt: Refactor “adorn-api” into a production-ready codegen-only backend framework (Express-first)

You are an expert TypeScript/Node framework engineer. You will refactor the entire codebase here into a coherent, production-ready library + CLI focused on **codegen-only** route + OpenAPI generation for a backend-only service (CRUD and non-CRUD endpoints), intended to front a SQL Server database with dozens of tables.

### Non-negotiable goals

1. **Codegen-only is the primary mode**:

   * Routes and OpenAPI are generated at build time (AST/ts-morph scanning).
   * Runtime reflection mode is removed or clearly marked “experimental” and not the default.
2. **Avoid legacy decorators**:

   * Do not require TS legacy decorator runtime behavior.
   * Decorators should be treated as compile-time markers for codegen (their runtime behavior must not be required for correctness).
3. **Developer ergonomics**:

   * VS Code/TypeScript strict mode should work cleanly.
   * Clear config, consistent behavior between generated routing and generated OpenAPI.

### Current critical problems you must fix (must not regress)

#### A) Config shape mismatch breaks generators

* The codebase defines a **nested config** shape (`generation`, `runtime`, `swagger`), but generators read a **flat config** (e.g. `config.tsConfig`, `config.controllersGlob`, `config.routesOutput`, `config.swaggerInfo`).
* Refactor so **all code uses the nested shape** consistently:

  * `config.generation.tsConfig`
  * `config.generation.controllersGlob`
  * `config.generation.routesOutput`
  * `config.swagger.info`
  * `config.swagger.outputPath`
  * `config.swagger.controllersGlob`
* Update `loadConfig()` and all generator usages accordingly.

#### B) CLI commands are currently no-ops

* `gen` must actually run:

  * `generateRoutes(config)`
  * `generateSwagger(config)`
* `serve` must boot runtime server in the selected framework (Express-first), and optionally auto-run codegen in dev mode if configured.

#### C) Runtime mode metadata handling is inconsistent/broken

* Route/schema metadata is stored on prototypes in legacy decorator style, but runtime reads from constructors.
* Because the primary target is codegen-only, either:

  * remove runtime-first entirely, OR
  * keep runtime as experimental but fix metadata placement consistently (prototype vs constructor) and make it fully functional.
* Do NOT keep two competing decorator systems (legacy and stage-3 initializer-based) that don’t interoperate.

#### D) Generated code has invalid “req/res/next” handling

* The generator emits `const req = req;` / `const res = res;` / `const next = next;` which is incorrect and must be removed.
* Generated handlers must be clean, lint-safe, and correct.

#### E) Express-only behavior is implicit; framework config is misleading

* Today codegen emits Express-only `RegisterRoutes(app: Express)` even though config allows `fastify`.
* Make framework support explicit:

  * Express is first-class and fully supported.
  * Fastify can be “planned” but must not be advertised as working unless implemented end-to-end (middleware, auth, error flow, etc.).

#### F) Param binding logic diverges between routes and swagger

* Swagger generator infers query/path/body using DTO property decorators (`FromQuery`, `FromPath`, `FromBody`, etc.).
* Route generator currently merges `query + params + body` into objects, causing collisions and making docs lie.
* Refactor so:

  * **The route generator uses the same inference model** as swagger generation.
  * Docs and runtime behavior always match.

#### G) Auth + error adapters: correctness + performance issues

* Do not instantiate auth/error adapters per request.
* If `authMiddlewarePath` is undefined, code must not crash.
* Fix “role” handling (if roles exist, define a clear contract; otherwise remove role plumbing).

#### H) Two incompatible ErrorAdapter contracts exist

* One path expects `{statusCode,message,details}` mapping.
* Another expects returning an `Error` to `next(err)`.
* Pick **one** error model and apply it everywhere (generator + runtime + adapters). Prefer:

  * Express-first: adopt Express-style `next(err)` + centralized error middleware adapter.
  * Optionally provide a helper that maps domain errors → HTTP responses in a single place.

#### I) Runtime routing scaling concerns (if runtime is kept)

* Linear `.find()` per request and “new controller per route” are not acceptable long-term.
* If runtime remains, refactor routing to a method+path map/trie and instantiate controllers per request (or use DI container hooks).

#### J) Swagger schema correctness improvements

* Map TypeScript `number` to OpenAPI `number` (not `integer`) by default.
* For unions:

  * literal unions → `enum`
  * non-literal unions → `oneOf` (not “first member wins”)
* Ensure this works well for SQL Server common types (money/decimal/time/date).

---

## Target architecture (what to build)

### 1) Library vs CLI separation

* The package must have:

  * `src/index.ts` exporting the **library API only** (decorators, types, adapters, helpers)
  * `src/cli/*` for CLI implementation (not exported from library entry)
  * `bin` entry configured in package metadata (CLI should not be imported accidentally by library consumers)

### 2) Single source of truth: generation output

* Codegen produces:

  * `routes.generated.ts` (Express router registration, controllers wired)
  * `openapi.generated.json` (or `.ts`) matching actual routing
* Runtime server just imports generated routes and mounts them.

### 3) Decorator strategy

* Decorators are **compile-time markers** for ts-morph scanning.
* Runtime metadata storage should not be required for correctness.
* Export only one decorator set (remove/stop exporting the legacy one).
* Keep decorator names stable (`@Controller`, `@Get`, `@Post`, `@Authorized`, `@FromQuery`, `@FromPath`, `@FromBody`, etc.) because generators detect by name.

### 4) Request binding and validation

* Generated routes must:

  * Bind parameters deterministically using DTO property decorators (query/path/body/headers)
  * Avoid collisions (path wins for path params; query/body separated)
  * Provide hooks for validation (pluggable: Zod/class-validator/custom)

### 5) Auth and error handling

* Auth adapter:

  * Instantiated once at module init (or server boot)
  * Only applied when a route requires it
* Error handling:

  * One consistent contract across generator/runtime
  * No double-handling, no per-request require/import overhead

---

## Deliverables

### Must-do refactor outputs

1. A corrected config system: one shape, documented, used everywhere.
2. Working CLI:

   * `adorn gen` generates routes + OpenAPI
   * `adorn serve` starts Express server using generated routes
3. Generated routes:

   * No invalid code (remove `const req=req` etc.)
   * No per-request adapter instantiation
   * Request binding matches swagger inference
4. Swagger generator:

   * Correct number/union behavior
   * Parameters reflect actual runtime behavior
5. Packaging cleanup:

   * CLI separated from library exports
   * Clear entrypoints

### Acceptance criteria (tests / verification)

* A small example app (fixtures) with:

  * one CRUD controller
  * one non-CRUD controller endpoint
  * one DTO using `FromQuery/FromPath/FromBody`
  * one `@Authorized` route
* Running:

  * `adorn gen` produces compilable outputs
  * `adorn serve` boots and routes work
  * OpenAPI matches actual routing + params
* TypeScript strict build passes.

---

## Execution plan (do this step-by-step)

1. Normalize config: update config types, `loadConfig()`, then fix both generators to read nested config.
2. Fix CLI to call generators and start server.
3. Decide mode:

   * Make codegen-only default.
   * Remove runtime-first or quarantine it behind an “experimental” flag.
4. Unify decorators:

   * Export one decorator implementation.
   * Ensure generator recognizes decorator names reliably.
5. Refactor generate-routes:

   * Fix `req/res/next` bug
   * Implement param source inference matching swagger logic
   * Move adapter instantiation outside handlers
6. Refactor adapters:

   * Single ErrorAdapter contract everywhere
   * AuthAdapter contract with optional roles
7. Improve swagger generator schemas:

   * number → number
   * unions → enum/oneOf
8. Add example + minimal tests (smoke tests ok).
9. Ensure packaging does not export CLI from library index.

---

## Constraints / style

* Keep changes cohesive: reduce duplicate code and remove dead/experimental paths instead of letting them accumulate.
* Prefer explicitness over magic. This is intended for a large CRUD-heavy backend.
* Avoid breaking public decorator names unless absolutely necessary; if you break them, provide a migration note.

---

If you follow this prompt, the refactor should produce a clean “adorn-api” that is realistic to use as the backend for a PHP monolith migration with many SQL Server tables, without the legacy decorator conflicts and without runtime reflection brittleness.
