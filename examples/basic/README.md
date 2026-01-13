# Adorn-API Basic Example

This example demonstrates the basic usage of Adorn-API smart decorators.

## Features

- `@List()` - Collection endpoints (GET)
- `@Create()` - Creation endpoints (POST)
- `@Update()` - Update endpoints (PUT)
- `@Delete()` - Deletion endpoints (DELETE)
- OpenAPI documentation generation

## Running

```bash
npm run example:basic
```

## Endpoints

| Method | Path       | Description       |
| ------ | ---------- | ----------------- |
| GET    | /users     | List all users    |
| GET    | /users/:id | Get user by ID    |
| POST   | /users     | Create user       |
| PUT    | /users/:id | Update user       |
| DELETE | /users/:id | Delete user       |
| GET    | /products  | List all products |
| POST   | /products  | Create product    |

## OpenAPI Docs

Visit http://localhost:3000/api-docs to view the generated OpenAPI specification.

## Example Request

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "role": "admin"}'

# List all users
curl http://localhost:3000/users
```
