# OpenAPI generation

The Express adapter optionally builds OpenAPI v3 metadata and serves both the JSON document and Swagger UI out of the box.

- `src/core/openapi/buildOpenApi.ts` produces the final `OpenApiDocumentObject` by walking the controller registry and translating request/response schemas into OpenAPI components.
- `createAdornExpressApp` (`src/adapters/express/createApp.ts`) exposes the `openapi` option to toggle JSON/docs paths, enable Swagger UI, and customize titles/servers.
- When Swagger UI is enabled, `src/adapters/express/swagger/serve.ts` hooks up the UI assets plus a JSON endpoint. The app wires the router and OpenAPI middleware before installing the shared `adornErrorHandler`.

If you need to expose your own docs, re-use the `buildOpenApi` helper and mount the resulting JSON file or Swagger UI router at any path. You can also disable the automatic docs by passing `openapi: { enabled: false }`.
