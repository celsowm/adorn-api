# Adorn API CLI Usage Guide

## Overview

Adorn API provides two distinct modes for running your API:

1. **Code Generation Mode** (Primary/Recommended) - Generates routes and OpenAPI at build time
2. **Runtime Mode** (Experimental) - Uses runtime reflection to register routes dynamically

---

## CLI Commands

### `adorn gen` - Generate Code

Generates routes and OpenAPI documentation from your controllers.

```bash
# Generate both routes and Swagger
adorn gen

# Generate only routes
adorn gen --routes

# Generate only Swagger
adorn gen --swagger

# Use custom config file
adorn gen -c ./my-config.ts
```

**What it does:**
- Scans controller files using AST/ts-morph
- Generates `routes.generated.ts` with Express route handlers
- Generates OpenAPI/Swagger specification
- Uses decorators as compile-time markers (no runtime behavior required)

**Output files:**
- `routes.generated.ts` - Express router registration
- `openapi.generated.json` - OpenAPI 3.0 specification

---

### `adorn serve` - Run API Server

Runs your API server in either runtime or codegen mode.

#### Runtime Mode (Default)

```bash
# Start server in runtime mode (uses reflection)
adorn serve

# Custom port
adorn serve -p 8080

# Custom config
adorn serve -c ./my-config.ts
```

**How it works:**
- Loads controller classes dynamically at runtime
- Uses decorator metadata stored on prototypes
- No code generation required
- **Experimental** - intended for development and testing

**Use case:** Quick development iterations without build steps

---

#### Codegen Mode (Recommended for Production)

```bash
# Auto-generate code, then start server (dev mode)
adorn serve --gen

# With custom port
adorn serve --gen -p 8080
```

**How it works:**
1. Runs `adorn gen` to generate routes and Swagger
2. Starts server using the generated routes
3. Uses `RegisterRoutes()` function from generated file

**Use case:** Production deployments, consistent behavior, predictable performance

---

## Modes Comparison

| Feature | Codegen Mode | Runtime Mode |
|---------|--------------|--------------|
| Route Discovery | Build-time (AST) | Runtime (reflection) |
| Performance | Fast (no reflection) | Slower (per-request metadata) |
| Reliability | High (static analysis) | Medium (runtime errors possible) |
| Startup Time | Faster | Slower (scanning required) |
| Production Ready | ✅ Yes | ⚠️ Experimental |
| Hot Reload | Requires rebuild | Automatic |
| Debugging | Clear generated code | Metadata complexity |

---

## Typical Workflows

### Development Workflow (Fast Iteration)

```bash
# Terminal 1: Start server with auto-generation
adorn serve --gen -p 3000
```

Edit your controllers, then:
```bash
# In another terminal, regenerate
adorn gen
# Server will use new routes on next request
```

### Production Deployment Workflow

```bash
# Build your TypeScript project
npm run build

# Generate final routes and docs
adorn gen

# Start your production server (using generated routes)
# In your server entry point:
import { RegisterRoutes } from './routes.generated.js';
import express from 'express';

const app = express();
RegisterRoutes(app);
app.listen(3000);
```

---

## Architecture

### Codegen Mode

```
Controllers (TypeScript)
         ↓
    adorn gen
         ↓
Generated Routes (routes.generated.ts) ←───┐
         ↓                                  │
   Express Router <─────────────────────────┘
         ↓
   HTTP Requests
```

### Runtime Mode

```
Controllers (TypeScript)
         ↓
   Runtime API Server
         ↓ (reflects metadata)
   Route Registration
         ↓
   HTTP Requests
```

---

## Important Notes

### Decorators as Compile-Time Markers

In **codegen mode**, decorators are **only** used during code generation:
- `@Controller`, `@Get`, `@Post`, etc. are detected by name
- No runtime decorator behavior required
- No `emitDecoratorMetadata` or `experimentalDecorators` needed

In **runtime mode**, decorators must store metadata:
- Metadata is stored on class prototypes
- Uses `Reflect` API or Symbol-based storage
- Requires TypeScript decorator configuration

### Why Codegen is Preferred

1. **Predictable** - Errors caught at build time
2. **Fast** - No reflection overhead
3. **Compatible** - Works with any TypeScript setup
4. **Testable** - Generated code can be inspected
5. **Minimal Runtime** - No heavy reflection dependencies

### When to Use Runtime Mode

- Quick prototyping without build steps
- Testing decorator changes
- Exploring the framework
- **Not recommended for production**

---

## Configuration

Both modes use the same `adorn.config.ts`:

```typescript
const config: AdornConfig = {
  generation: {
    controllersGlob: 'src/controllers/**/*.ts',
    routesOutput: './routes.generated.ts',
    basePath: '/api',
    // ...
  },
  swagger: {
    enabled: true,
    outputPath: './openapi.generated.json',
    // ...
  },
  runtime: {
    validationEnabled: false,
    useClassInstantiation: false,
    // Only used in runtime mode
  }
};
```

---

## Troubleshooting

### "Controller not loaded" in runtime mode

Ensure:
- Controllers are exported
- Decorator syntax is correct
- TypeScript config has `experimentalDecorators: true`

### Generated routes empty

Check:
- `controllersGlob` matches your file structure
- Controllers have `@Controller` decorator
- Methods have HTTP method decorators (`@Get`, `@Post`, etc.)

### Windows path errors

The CLI now uses `url.pathToFileURL()` for cross-platform compatibility. If you still see errors:
- Use forward slashes in config paths
- Ensure TypeScript files are compiled to `.js`

---

## See Also

- [REFACTOR.md](./REFACTOR.md) - Refactoring goals and architecture
- [REFACTOR_CHECKLIST.md](./REFACTOR_CHECKLIST.md) - Implementation progress
- [src/core/decorators.ts](./src/core/decorators.ts) - Decorator API reference
