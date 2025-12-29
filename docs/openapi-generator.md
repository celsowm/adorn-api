# OpenAPI Generation

The `adorn-api` package provides built-in OpenAPI documentation generation from your controller definitions.

## Basic OpenAPI Generation

The `buildOpenApi` function produces an `OpenApiDocumentObject` by walking the controller registry and translating request/response schemas into OpenAPI components:

```typescript
import { buildOpenApi } from 'adorn-api';
import { createAdornExpressApp } from 'adorn-api/express';

const app = createAdornExpressApp({
  controllers: [UsersController, PostsController],
});

const openApiDoc = buildOpenApi(app, {
  title: 'My API',
  version: '1.0.0',
  description: 'API documentation',
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
    path: '/docs',           // Swagger UI path
    jsonPath: '/openapi.json', // OpenAPI JSON endpoint
    title: 'My API',
    version: '1.0.0',
  },
});
```

## OpenAPI Decorators

Route decorators attach OpenAPI metadata to routes:

- `@Tags('Tag Name')` - Group routes under a tag
- `@OperationId('operationName')` - Assign unique operation IDs
- `@Deprecated()` - Mark routes as deprecated
- `@Response(200, { description: 'Success', schema: UserSchema })` - Define response schemas
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
