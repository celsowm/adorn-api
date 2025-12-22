# REFACTOR Checklist (Status)

The following checklist is derived directly from the refactor instructions currently preserved in `REFACTOR.md`. Each item is marked according to whether it has been addressed in the current codebase. As no automated analysis has run yet, all items currently remain unchecked (`[ ]`).

## Non-negotiable goals
- [ ] Ensure codegen-only is the primary mode (routes/OpenAPI generated at build time, runtime reflection removed or experimental)
- [ ] Avoid legacy decorators that require runtime behavior
- [ ] Guarantee developer ergonomics: strict TypeScript support, consistent config and generated artifacts

## Critical problems to fix
- [ ] A) Normalize config usage so every consumer uses `config.generation.*` and `config.swagger.*`
- [ ] B) Make CLI commands operational (`adorn gen` running both generators and `adorn serve` starting Express with optional dev codegen)
- [ ] C) Either remove runtime-first path or fix prototype/constructor metadata handling and eliminate competing decorator systems
- [ ] D) Eliminate invalid generated code patterns (remove `const req = req`, etc.)
- [ ] E) Make framework support explicit (Express fully supported, Fastify only if implemented end-to-end)
- [ ] F) Align route generation parameter inference with Swagger generation’s decorator-based model
- [ ] G) Instantiate auth/error adapters once, avoid crashes when optional paths are undefined, clarify role handling contract
- [ ] H) Unify on a single ErrorAdapter contract (prefer Express `next(err)` flow)
- [ ] I) Refactor runtime routing for scalability (path map/trie, instantiating controllers per request) if runtime remains
- [ ] J) Improve Swagger schema generation (number → number; literal unions as enums; non-literal unions as oneOf)

## Target architecture & deliverables
- [ ] Separate library (`src/index.ts`) from CLI (`src/cli/*`, `bin` entry)
- [ ] Generate routes (`routes.generated.ts`) and OpenAPI (`openapi.generated.json`) from a single source of truth
- [ ] Treat decorators as compile-time markers and expose only the unified decorator set
- [ ] Implement deterministic request binding with DTO decorator inference and validation hooks
- [ ] Ensure auth adapter is singleton at boot and error handling employs one consistent contract
- [ ] Provide example fixture with CRUD + non-CRUD controller, DTO using `From*` decorators, and `@Authorized` route
- [ ] `adorn gen` produces compilable outputs and `adorn serve` boots Express with matching OpenAPI documentation
- [ ] Serve strict TypeScript build
- [ ] Separate CLI from library exports in packaging

## Execution plan steps (deriving from instructions)
- [ ] Normalize config and align generators with nested config shape
- [ ] Fix CLI to trigger code generation and server boot
- [ ] Decide and enforce codegen-only default/experimental runtime
- [ ] Unify decorators into one implementation recognized by generators
- [ ] Refactor route generator to fix handler internals and parameter inference
- [ ] Refactor adapters to a single error contract and stable auth contract
- [ ] Improve Swagger schema generation for numbers and unions
- [ ] Add example fixtures/tests
- [ ] Prevent CLI exports from leaking through library entry
