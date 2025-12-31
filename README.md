# Adorn-API

Stage-3 decorator-first OpenAPI + routing toolkit for TypeScript.

## Quick Start

```bash
npm install adorn-api
```

### Basic Example

```typescript
import { Controller, Get, Post } from "adorn-api";

@Controller("/users")
class UserController {
  @Get("/")
  async getUsers() {
    return [{ id: 1, name: "Alice" }];
  }

  @Post("/")
  async createUser(body: { name: string; email: string }) {
    return { id: 2, name: body.name };
  }
}
```

Run with Express:

```typescript
import { bootstrap } from "adorn-api/express";

await bootstrap({
  controllers: [UserController],
});
```

Or with full control:

```typescript
import express from "express";
import { createExpressRouter } from "adorn-api/express";

const app = express();
app.use(await createExpressRouter({
  controllers: [UserController],
  artifactsDir: ".adorn"
}));
```

## Features

- **Simplified server setup** with `bootstrap()` function
- **Decorator-based routing** with `@Controller`, `@Get`, `@Post`, etc.
- **Automatic OpenAPI 3.1** generation
- **Runtime validation** with AJV
- **Authentication** with `@Auth()` and `@Public()`
- **Type-safe** - full TypeScript support
- **Incremental builds** with caching

## Try Examples

```bash
# Run the basic example
npm run example basic

# Then open http://localhost:3000/docs
```

See [examples/](examples/) directory for more examples.

### Bootstrap vs Full Control

The `bootstrap()` function provides a quick way to get started with sensible defaults:

```typescript
import { bootstrap } from "adorn-api/express";
import { UserController } from "./controller.js";

await bootstrap({
  controllers: [UserController],
});
```

For more control, use the full API:

```typescript
import express from "express";
import { createExpressRouter, setupSwagger } from "adorn-api/express";

const app = express();
app.use(express.json());

const router = await createExpressRouter({
  controllers: [UserController],
  artifactsDir: ".adorn",
  middleware: { /* ... */ },
  auth: { /* ... */ }
});

app.use(router);
app.use(setupSwagger({
  artifactsDir: ".adorn",
  swaggerOptions: {
    servers: [{ url: "http://localhost:3000" }]
  }
}));

app.listen(3000);
```

## Documentation

- [Decorators](src/decorators/) - Route, auth, and middleware decorators
- [Express Adapter](src/express.ts) - Express integration
  - `bootstrap()` - Quick server setup with defaults
  - `createExpressRouter()` - Full control over router creation
  - `setupSwagger()` - Swagger UI setup
- [Schema Decorators](src/schema/) - Validation decorators
- [CLI](src/cli.ts) - Build and manage artifacts

## License

MIT
