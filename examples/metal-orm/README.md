# Adorn-API Metal-ORM Integration Example

An advanced example demonstrating Adorn-API's integration with Metal-ORM for type-safe database operations and DTO support.

## Features Demonstrated

- Stage 3 decorators
- Express integration
- Metal-ORM entities and queries
- @DtoResponse decorator for automatic OpenAPI schema generation
- Type-safe database operations
- SQLite in-memory database

## Running the Example

\`\`\`bash
npm install
npm run dev
\`\`\`

The API will be available at http://localhost:3000

## API Endpoints

All endpoints return data typed according to Metal-ORM table definitions:

- \`GET /api/users\` - Get all users
- \`GET /api/users/:id\` - Get user by ID
- \`POST /api/users\` - Create new user
- \`PUT /api/users/:id\` - Update user (full)
- \`PATCH /api/users/:id\` - Update user (partial)
- \`DELETE /api/users/:id\` - Delete user

## Metal-ORM Integration

The \`@DtoResponse\` decorator automatically extracts type information from Metal-ORM table definitions and generates accurate OpenAPI schemas. This provides:

- Automatic type mapping (varchar → string, int → integer, etc.)
- Proper required/optional field handling
- Consistent API documentation

## OpenAPI Documentation

Access the auto-generated OpenAPI spec at:
- \`GET /api-docs\`
