# Simple Auth Example

A simple authentication API demonstrating Adorn-API's `@Auth()` and `@Public()` decorators with bearer token authentication.

## Features

- **Public endpoints** accessible without authentication
- **Protected endpoints** requiring valid bearer tokens
- **Scope-based authorization** for fine-grained access control
- **Login/logout** functionality
- **Swagger UI** at `/docs` for interactive API testing

## Test Users

| Username | Password | Role | Scopes |
|----------|----------|------|--------|
| alice | password123 | admin | read, write, admin |
| bob | password123 | user | read |

## Quick Start

```bash
# From the project root
npm run example simple-auth

# Then open http://localhost:3000/docs
```

## Manual Setup

```bash
# Install dependencies
cd examples/simple-auth
npm install

# Build TypeScript & generate .adorn artifacts
npm run build

# Start development server with hot-reload
npm run dev

# Start production server
npm run start
```

## API Endpoints

### Authentication

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | /auth/login | No | Login and get bearer token |
| POST | /auth/logout | Yes | Logout and invalidate token |

### API Endpoints

| Method | Path | Auth Required | Scopes | Description |
|--------|------|---------------|--------|-------------|
| GET | /api/public | No | - | Public endpoint |
| GET | /api/profile | Yes | - | Get current user profile |
| GET | /api/data | Yes | read | Get data (requires read scope) |
| POST | /api/items | Yes | write | Create item (requires write scope) |
| GET | /api/admin | Yes | admin | Admin-only endpoint |
| GET | /api/all-users | Yes | - | List all users |

## Testing the API

### Using Swagger UI

1. Open http://localhost:3000/docs
2. Click "Try it out" for the `/auth/login` endpoint
3. Login with `alice` / `password123`
4. Copy the token from the response
5. Click "Authorize" at the top and enter `Bearer <token>`
6. Test protected endpoints

### Using curl

#### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

Response:
```json
{
  "token": "token-1704067200000-1",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "role": "admin"
  }
}
```

#### Access Protected Endpoint (with token)

```bash
# Replace <token> with the token from login
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer <token>"
```

#### Access Public Endpoint (no token required)

```bash
curl http://localhost:3000/api/public
```

#### Access Endpoint Without Token (401 Unauthorized)

```bash
curl http://localhost:3000/api/profile
```

Response:
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Bearer token. Please login at POST /auth/login"
}
```

#### Access Endpoint Without Required Scope (403 Forbidden)

Bob (with only `read` scope) tries to access admin endpoint:

```bash
curl http://localhost:3000/api/admin \
  -H "Authorization: Bearer <bob-token>"
```

Response:
```json
{
  "error": "Forbidden",
  "message": "Insufficient scopes. Required: ['admin']"
}
```

#### Create Item (requires write scope)

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Item"}'
```

#### Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <token>"
```

## Project Structure

```
simple-auth/
├── src/
│   └── controller.ts       # Controllers with @Auth and @Public decorators
├── .adorn/                 # Generated artifacts
│   ├── openapi.json        # OpenAPI 3.1 spec
│   ├── manifest.json       # Runtime binding metadata
│   └── cache.json         # Build cache
├── server.ts               # Express server with auth runtime setup
├── tsconfig.json           # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## What's Next?

- Explore the [basic example](../basic/) for simpler CRUD operations
- Check the [blog-platform example](../blog-platform-metal-orm/) for database integration
- Read the [main documentation](../../README.md)
- Learn more about [authentication decorators](../../src/decorators/)
