# Basic Example

A simple CRUD API demonstrating Adorn-API basics.

## Features

- **GET /api/users** - List all users
- **GET /api/users/:id** - Get a specific user
- **POST /api/users** - Create a new user
- **Swagger UI** at `/docs` - Interactive API documentation
- **OpenAPI JSON** at `/docs/openapi.json` - Machine-readable spec

## Quick Start

```bash
# From the project root
npm run example basic

# Then open http://localhost:3000/docs
```

## Manual Setup

```bash
# Install dependencies
npm install

# Build TypeScript & generate .adorn artifacts
npm run build

# Start development server with hot-reload
npm run dev

# Start production server
npm run start
```

## Testing the API

### Using Swagger UI

1. Open http://localhost:3000/docs
2. Try the "Try it out" button for each endpoint
3. Click "Execute" to send requests

### Using curl

```bash
# Get all users
curl http://localhost:3000/api/users

# Get specific user
curl http://localhost:3000/api/users/1

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","email":"charlie@example.com"}'
```

## Project Structure

```
├── src/
│   └── controller.ts      # API controller with decorators
├── .adorn/               # Generated artifacts
│   ├── openapi.json       # OpenAPI 3.1 spec
│   ├── manifest.json      # Runtime binding metadata
│   └── cache.json        # Build cache
├── server.ts             # Express server setup
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies
```

## What's Next?

- Check the [full example](../full/) for authentication and validation features
- Read the [main documentation](../../README.md)
- Explore [decorators](../../src/decorators/) for more features
