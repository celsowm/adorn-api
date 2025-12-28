# Controller decorators

Controllers and route methods use the Stage‑3 decorators exported from `src/decorators/index.ts`, which internally record metadata on the class/method via `src/metadata/keys.ts` and `src/metadata/bag.ts`.

- `@Controller('/path')` (`src/decorators/controller.ts`) normalizes the base path and stores it in the meta bag.
- `@Get`, `@Post`, `@Put`, `@Patch`, and `@Delete` (`src/decorators/methods.ts`) wrap your handler with route metadata (HTTP verb + normalized path + validation/response options) via `RouteMeta`.
- The controller metadata is assembled when the registry is built (`src/core/registry/buildRegistry.ts`), which applies the routes to an Express router in `src/adapters/express/router.ts`.

Use `controllerFactory` in the Express adapter to inject dependencies such as `OrmSession` per request (`test/e2e/metal-orm.adorn-api.rest.spec.ts` shows one example). Validation schemas live alongside the controllers (`src/integrations/metal-orm/schema`), but any schema can be used via route options.
