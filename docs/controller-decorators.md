# Controller decorators

Controllers and route methods use Stage‑3 decorators exported from the main `adorn-api` package. These decorators record metadata internally and use it to build routes and generate OpenAPI documentation.

## Available Decorators

### Controller Definition
- `@Controller('/path')` - Defines a controller with a base path

### HTTP Method Decorators
- `@Get`, `@Post`, `@Put`, `@Patch`, and `@Delete` - Define route handlers with HTTP verbs

### Documentation Decorators
- `@Tags`, `@OperationId`, and `@Deprecated` - Attach OpenAPI-friendly metadata to routes

### Response Decorators
- `@Response` and `@Responses` - Add per-route response specifications (status, descriptions, headers, schemas)

### Security Decorators
- `@Security` and `@SecurityScheme` - Declare OpenAPI security requirements and component schemes

### Parameter Binding
- `@Bindings` - Define parameter binding rules for route handlers (e.g., type hints for path parameters)

## Usage Example

```typescript
import { Controller, Get, Bindings } from 'adorn-api';

@Controller('/users')
class UsersController {
  @Bindings({ path: { id: 'int' } })
  @Get('/{id}')
  getUser(id: number) {
    return { id, name: 'User ' + id };
  }
}
```

**Note:** The framework uses automatic parameter binding based on parameter names and types. For path parameters, use `@Bindings` to provide type hints when needed. Query parameters and request bodies are automatically bound based on the parameter names and types in your handler methods.

## Integration with Express

Use `createAdornExpressApp` from the `adorn-api/express` package to create an Express application with your controllers:

```typescript
import { createAdornExpressApp } from 'adorn-api/express';
import { Controller, Get } from 'adorn-api';

@Controller('/api/users')
class UsersController {
  @Get('/')
  listUsers() {
    return [{ id: 1, name: 'Alice' }];
  }
}

const app = createAdornExpressApp({
  controllers: [UsersController],
});
```

## Custom Controller Factories

Use the `controllerFactory` option in the Express adapter to inject dependencies such as database sessions per request:

```typescript
import { createAdornExpressApp } from 'adorn-api/express';
import type { ControllerCtor } from 'adorn-api';
import type { Request, Response } from 'express';

const app = createAdornExpressApp({
  controllers: [UsersController],
  controllerFactory: (ctor: ControllerCtor, req: Request, res: Response) => {
    // Inject dependencies based on controller type
    return new ctor(/* your dependencies */);
  },
});
