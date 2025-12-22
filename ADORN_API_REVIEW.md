# Adorn API review notes

Context: this is feedback from migrating a real app (pgedigital-backend) off tsoa to adorn-api.
The main goal was to keep standard TC39 decorators (modern TS) and avoid legacy metadata.
This file focuses on real friction points, architectural gaps, and "nice to have" features.
You are open to iteration, including full overhaul if needed.

## Migration friction observed in this repo

- No CLI bin entry. The only reliable invocation was `node ./node_modules/adorn-api/dist/cli/*.js`.
- Route generator produced absolute import paths on Windows. This broke ESM resolution and tsc.
- `@Get('{id}')` produced `/resource:id` instead of `/resource/:id`. The join logic missed the slash.
- Route generator always returned HTTP 200; I had to patch it to return 201 for POST and 204 for DELETE.
- Generated routes attempted to import non-exported DTO classes because the generator imports every class in a controller file.
- The generated routes file had `statusCode === 204` comparisons against numeric literals with no type widening. This caused TS errors.
- Swagger output path is hard-coded to `./swagger.json`, which forced app changes and README updates.

## Architectural gaps and questionable defaults

- Route generation is fully static via ts-morph and does not use runtime metadata, yet decorators write metadata via `context.addInitializer()`. The runtime metadata is currently unused.
- The generator assumes a single DTO parameter (`params[0]`) and ignores any additional method parameters.
- The generator maps the request into a plain object; it never instantiates the DTO class, so defaults and class methods are skipped.
- No concept of global base path or per-controller base path normalization. This is why `@Get('{id}')` produced malformed paths.
- No hook to inject framework middleware (auth, tracing, request context). `@Authorized` is hard-coded to an import at `./middleware/auth.middleware.js`.
- No way to define response status codes, headers, or content types per method. Everything defaults to 200 with JSON.
- Error handling in generated routes is a blanket `500` with `err.message`. It bypasses the hosting app's error middleware.
- Swagger generator scans `src/**/*.ts` instead of a controller-only glob, which can pull in unrelated classes and DTOs.
- Swagger metadata uses hard-coded `info.title` and `info.version` values and cannot be configured.
- `FromQuery` and `FromPath` accept a `name` parameter but the generators ignore it; only property name is used.
- Swagger generation relies on "implicit rules" for body vs query if decorators are missing. This can mask mistakes.

## Missing features that matter in production

- Validation layer integration. There is no built-in way to run Zod/class-validator and return typed 400 responses.
- Proper error model. There is no standard error type or error response schema in Swagger.
- Auth middleware configuration. `@Authorized` has no custom hooks or a project-level auth registry.
- Response typing for non-JSON (file downloads, streams). The generator always returns JSON.
- Support for `@Header`, `@Cookie`, or `@Request` injection patterns.
- Support for multipart/form-data and file uploads in request bodies.
- Support for custom response codes in Swagger (201, 204, 400, 404, 422).
- Support for security schemes beyond bearer tokens (API keys, cookie auth, OAuth2).
- Controller tags and grouping (Swagger tags) are not surfaced.
- Better generics handling in Swagger (map types, Record, unions with objects, circular refs).
- Stable public types. The package ships no `.d.ts`, so TypeScript users need local shims.

## Suggestions for the next iterations

- Add a `bin` entry and CLI wrapper that accepts a config file (paths, controller globs, output dirs, basePath).
- Normalize route paths (ensure basePath + method path always join with a single `/`).
- Generate per-method status codes and allow opt-in overrides via a decorator (e.g., `@Status(201)`).
- Emit routes that call `next(err)` so app-level error handlers run.
- Create an adapter interface for auth so `@Authorized` can be wired to app-specific middleware.
- Instantiate DTO classes (or provide a factory hook) so defaults and transforms run predictably.
- Export a public type surface and ship `.d.ts` so TS users are not forced into shims.
- Add a controller-only scan and a safe allowlist for Swagger generation.
- Provide a validation integration hook (Zod/class-validator) with generated 400 responses.
- Add support for tags, summary, description, and response schemas in Swagger.

## Full overhaul plan

- Redesign the CLI around a single config file (project root, controllers glob, basePath, output paths).
- Move generation logic into a shared core package so CLI and runtime use the same contracts.
- Introduce a small runtime adapter layer (Express/Fastify) instead of hardcoding Express in generated code.
- Add a first-class schema/validation pipeline (Zod or JSON Schema) with consistent 4xx errors.
- Make status codes and response shapes explicit via decorators (`@Status`, `@Produces`, `@Errors`).
- Provide a minimal runtime to expose controller metadata directly (optional mode, no codegen).

## Notes about decorator mode

- The intent is TC39 standard decorators. It would help to document the required TS settings
  (avoid legacy `experimentalDecorators`, avoid `emitDecoratorMetadata`, and confirm ESM targets).
- A short "TS config checklist" in README would prevent support churn.
