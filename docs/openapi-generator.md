# OpenAPI Generation

The `adorn-api` package provides built-in OpenAPI documentation generation from your controller definitions.

## Basic OpenAPI Generation

The `buildOpenApi` function produces an `OpenApiDocumentObject` by walking the controller registry and translating request/response schemas into OpenAPI components:

```typescript
import { buildOpenApi, buildRegistry } from '@adorn/api';
import { createAdornExpressApp } from '@adorn/api/express';

const controllers = [UsersController, PostsController];
const app = createAdornExpressApp({ controllers });

const registry = buildRegistry(controllers);
const openApiDoc = buildOpenApi(registry, {
  title: 'My API',
  version: '1.0.0',
  description: 'API documentation',
  includeDefaultErrors: true,
});
```

## Express Integration

The Express adapter (`adorn-api/express`) exposes the `openapi` option to configure OpenAPI documentation:

```typescript
import { createAdornExpressApp } from 'adorn-api/express';

const app = createAdornExpressApp({
  controllers: [UsersController],
  openapi: {
    enabled: true,
    jsonPath: '/openapi.json',
    docsPath: '/docs',
    title: 'My API',
    version: '1.0.0',
  },
});
```

## Build Options

The `openapi` option surface exposes additional metadata and defaults. You can provide `description`, `termsOfService`, `contact`, `license`, or even emit `"3.1.0"` documents via `openapiVersion`. Use `includeDefaultErrors` to automatically append RFC 7807-style problem responses (customizable via `problemDetailsSchema`/`validationErrorSchema`), and override `defaultErrorContentType` if your API uses a different media type. OpenAPI generation also picks `201` for POST and `204` for DELETE when no responses are declared, matching the runtime's `pickSuccessStatus`.

```typescript
import { createAdornExpressApp } from 'adorn-api/express';

const app = createAdornExpressApp({
  controllers: [UsersController],
  openapi: {
    title: 'My API',
    version: '1.0.0',
    openapiVersion: '3.1.0',
    description: 'API documentation',
    termsOfService: 'https://example.com/terms',
    contact: { name: 'API Team', email: 'api@example.com' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    includeDefaultErrors: true,
    defaultErrorContentType: 'application/problem+json',
  },
});
```

## OpenAPI Decorators

Route decorators attach OpenAPI metadata to routes:

- `@Tags('Tag Name')` - Group routes under a tag
- `@OperationId('operationName')` - Assign unique operation IDs
- `@Deprecated()` - Mark routes as deprecated
- `@Response(200, { description: 'Success', schema: UserSchema })` - Define response schemas
- `@Returns(schema, { status?: 200 })` - Assign a schema to a response code without writing the full `responses` object
- `@Security('bearerAuth')` - Apply security requirements

```typescript
import { Controller, Get, Tags, OperationId, Response } from 'adorn-api';

@Controller('/users')
@Tags('User Management')
class UsersController {
  @Get('/{id}')
  @OperationId('getUserById')
  @Response(200, { description: 'User found' })
  @Response(404, { description: 'User not found' })
async getUser(id: number) {
      // Implementation
    }
  }
```

### Path parameter hints

If you skip `validate.params` or want to keep validation and documentation definitions separate, `@Bindings` can still describe a route's path parameters. For example:

```typescript
@Get('/{id}')
@Bindings({ path: { id: 'uuid' } })
async find(id: string) { ... }
```

OpenAPI will now describe `id` as a UUID instead of defaulting to `type: "string"`.

## Security Schemes

Define security schemes using the `@SecurityScheme` decorator:

```typescript
import { SecurityScheme } from 'adorn-api';

@SecurityScheme({
  name: 'bearerAuth',
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})
@Controller('/protected')
class ProtectedController {
  @Get('/data')
  @Security('bearerAuth')
  getProtectedData() {
    // Requires authentication
  }
}
```

## Schema Definitions

The system automatically generates OpenAPI schemas from:
- Controller parameter types
- Return types annotated with `@Response`
- Entity types from `adorn-api/metal-orm`

You can also provide custom schemas through the route decorators and the OpenAPI generation options.
