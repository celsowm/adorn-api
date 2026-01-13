# Adorn-API

A modern TypeScript API framework using **Stage 3 decorators** with Express support and Metal-ORM integration.

## Features

✨ **Stage 3 Decorators** - No legacy experimental decorators
🚀 **Express Integration** - Automatic route registration with Express.js
📝 **OpenAPI Generation** - Auto-generate OpenAPI 3.1 specs
🎯 **Metal-ORM Integration** - Native DTO support with automatic schema extraction
🔒 **Type Safety** - Full TypeScript support with type inference
⚡ **Zero Runtime Reflection** - No performance overhead from reflection
🛡️ **Middleware & Guards** - Composable middleware and route guards

## Installation

\`\`\`bash
npm install adorn-api express
\`\`\`

## Quick Start

```typescript
import express from 'express';
import { Controller, Get, Post, ExpressAdapter, OpenApiGenerator, type HttpContext } from 'adorn-api';

@Controller('/api/users')
class UsersController {
  @Get()
  getAllUsers(ctx: HttpContext) {
    return [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
  }

  @Post('/')
  createUser(ctx: HttpContext) {
    const newUser = ctx.req.body;
    newUser.id = Date.now();
    return newUser;
  }
}

const app = express();
app.use(express.json());

const adapter = new ExpressAdapter(app);
adapter.registerController(UsersController);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
\`\`\`

## Available Decorators

### Core Decorators

- `@Controller(path)` - Mark class as controller with base path
- `@Get(path)` - Define GET route
- `@Post(path)` - Define POST route
- `@Put(path)` - Define PUT route
- `@Patch(path)` - Define PATCH route
- `@Delete(path)` - Define DELETE route

### Advanced Decorators

- `@Use(...middleware)` - Apply middleware to controller or route
- `@Guard(...guards)` - Apply guards to controller or route
- `@ValidateBody(schema)` - Validate request body
- `@ValidateParams(schema)` - Validate request parameters
- `@Response(status, description, schema)` - Configure response

### Metal-ORM Integration

- `@DtoResponse(table)` - Set response type from Metal-ORM table

## HttpContext

The `HttpContext` provides convenient access to request data:

```typescript
interface HttpContext {
  req: Request;
  res: Response;
  next: NextFunction;
  params: HttpParams;
}

interface HttpParams {
  param(name: string): string | undefined;
  query(name: string): string | undefined;
  body<T>(): T;
  header(name: string): string | undefined;
  all<T>(): T;
}
\`\`\`

## OpenAPI Generation

Generate OpenAPI documentation:

```typescript
import { OpenApiGenerator } from 'adorn-api';

const generator = new OpenApiGenerator();
const openApiDoc = generator.generateDocument({
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API Description',
  },
});

app.get('/api-docs', (_req, res) => {
  res.json(openApiDoc);
});
\`\`\`

## Examples

- [Basic Example](./examples/basic) - Simple API without database
- [Metal-ORM Integration](./examples/metal-orm) - Type-safe database operations

## Architecture

Adorn-API follows SOLID principles:

- **Single Responsibility**: Each decorator/class has one job
- **Open/Closed**: Extensible via middleware/guards
- **Liskov Substitution**: Controllers are swappable
- **Interface Segregation**: Focused, small interfaces
- **Dependency Inversion**: Express adapter pattern

## Stage 3 Decorators

Adorn-API uses only ECMAScript Stage 3 decorators (finalized in March 2022):

- Class decorators
- Method decorators
- Field decorators
- Accessor decorators

**NOT used** (Stage 1):
- ❌ Parameter decorators (separate proposal)
- ❌ Decorator metadata (separate proposal)

This means no experimental flags are needed - just use TypeScript 5.0+!

## Testing

Comprehensive test coverage:
- Unit tests for decorators and metadata storage
- Integration tests with Express and Supertest
- E2E tests with SQLite in-memory database
- Metal-ORM integration tests

Run tests:
\`\`\`bash
npm test          # Run all tests
npm run test:unit   # Run unit tests
npm run test:integration  # Run integration tests
npm run test:e2e  # Run E2E tests
npm run test:coverage  # Run tests with coverage
\`\`\`

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT

## Acknowledgments

Inspired by modern frameworks like TSOA, NestJS, and others, but built specifically for Stage 3 decorators and Metal-ORM integration.
