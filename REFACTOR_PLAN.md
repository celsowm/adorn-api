# Refactor Roadmap for Adorn API

Based on the migration review notes in `ADORN_API_REVIEW.md`, this document lays out a detailed multi-step refactor that spans stabilization, integration hooks, validation, and the proposed architecture overhaul. Each section groups related friction points / gaps and ties them to concrete actions.

## Phase 1 — Stabilize the Code Generator (1–2 weeks)
- **Add a proper CLI entry** (bin entry + wrapper) that accepts a single config file covering controller globs, output dirs, basePath, swagger path, etc. Fixes the “no CLI bin” friction.
- **Normalize route paths** (ensure basePath + method path always join with a single `/`) so `@Get('{id}')` yields `/resource/:id`, and document the expected TC39 decorator settings.
- **Emit correct status codes** per HTTP verb (200/201/204 defaults) and allow `@Status` overrides.
- **Return status-aware responses** (POST returns 201, DELETE 204, others 200) and remove literal comparisons that break TS.
- **Prevent unsafe imports** by restricting the generator to exported DTOs/symbols.
- **Make swagger output path configurable** instead of hard-coding to `./swagger.json`.
- **Tests**: route path joining, status code defaults/overrides, DTO import filtering.

## Phase 2 — Integration Hooks (2–3 weeks)
- **Runtime auth adapter** for `@Authorized` so projects can plug Express/Fastify middleware instead of a hard-coded `./middleware/auth.middleware.js`.
- **Inject middleware hooks** for auth/tracing/request context at runtime via a shared adapter interface.
- **DTO instantiation hook** or factory so defaults/class methods apply rather than mapping to plain objects.
- **Generate `next(err)` calls** in routes to let hosting apps’ error handlers run, plus an optional error-mapping hook instead of blanket `500` with `err.message`.
- **Allow additional method parameters** beyond the assumed single DTO (`params[0]`).
- **Controller-only swagger scan** (configurable glob) to avoid picking up unrelated classes.
- **Tests**: adapter integration, error propagation, DTO instantiation.

## Phase 3 — Validation, Responses, and Swagger Fidelity (3–4 weeks)
- **Validation pipeline** (hook for Zod/class-validator) with consistent 4xx error schema in responses and swagger.
- **Explicit response metadata** via decorators like `@Status`, `@Produces`, `@Errors`, and support for non-JSON responses (files/streams).
- **FromHeader/FromCookie/FromRequest support** plus multipart/form-data + file upload decorators.
- **Swagger improvements**: configurable `info.title`/`info.version`, tags, summaries, response schemas, security schemes beyond bearer, better generics handling (maps, unions, circular refs).
- **Swagger response statuses** including 201/204/400/404/422 with proper schemas.
- **Document validation+error models** so Swagger can show the true API surface.
- **Tests**: validation 400 responses, swagger snapshots, security scheme demos.

## Phase 4 — Architecture Overhaul (4–6 weeks)
- **Config-centered CLI + shared core** package so CLI and runtime consume the same generation contracts, enabling reuse and consistency.
- **Runtime adapter layer** for Express/Fastify to avoid embedding Express-specific code in generated files.
- **Optional runtime metadata mode** (no codegen) to expose controller metadata directly for advanced use cases.
- **Stable TypeScript surface**: ship `.d.ts` declarations so consumers don’t need shims.
- **Shared schema/validation layer** with plug-in points for DTO factories and response builders.
- **Tests**: adapter contract suites, backwards compatibility/regression verification.

## Docs & Quality (parallel work)
- **TC39 decorator checklist** in README (no `experimentalDecorators`, no `emitDecoratorMetadata`, ESM targets, etc.).
- **Migration notes** covering route generator fixes, status code behavior, swagger config, validation expectations.
- **Changelog entries** tied to each milestone (stabilization, hooks, validation, overhaul).
- **Additional tests**: ensure swagger walk uses controller-only globs, status code emission tests, DTO instantiation coverage.

## Next Steps / Ownership
1. Confirm preferred validation library (Zod vs class-validator) and runtime adapters (Express/Fastify).
2. Assign owners per phase (tooling, runtime, schema) and coordinate on shared core interfaces.
3. Track regression risks (route paths/status codes/swagger path) and add automated tests to guard them.
