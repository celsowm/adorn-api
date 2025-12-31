# Adorn-API Examples

This directory contains example applications demonstrating how to use Adorn-API.

## Quick Start

```bash
# Install dependencies for all examples
npm run examples:install

# Run the basic example
npm run example basic
```

This will:
1. Build the Adorn-API artifacts (OpenAPI spec, manifest, validators)
2. Start the Express server with hot-reload
3. Open the server at http://localhost:3000/docs

## Examples

### Basic

A simple CRUD API for users with:
- GET `/users` - List all users
- GET `/users/:id` - Get a specific user
- POST `/users` - Create a new user

The server includes:
- **Swagger UI** at `/docs` for interactive API testing
- **OpenAPI JSON** at `/docs/openapi.json`
- **Hot reload** with `tsx watch`

### Full (Coming Soon)

Advanced example with authentication, validation, and middleware.

## Development

Each example has its own package.json with scripts:

```bash
cd examples/basic
npm install
npm run build    # Compile TypeScript & generate .adorn artifacts
npm run dev      # Start server with hot-reload
npm run start    # Start production server
```

## Using Published Package

The examples use `"adorn-api": "file:../.."` to reference the local package for development. After publishing to npm, change to:

```json
{
  "dependencies": {
    "adorn-api": "^0.1.0"
  }
}
```

## API Documentation

When the example is running:
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs/openapi.json

You can test the API directly from the Swagger UI interface.
