# Adorn-API Basic Example

A simple example demonstrating the core features of Adorn-API.

## Features Demonstrated

- Stage 3 decorators (@Controller, @Get, @Post, @Put, @Patch, @Delete)
- Express integration
- Automatic route registration
- OpenAPI documentation generation
- HttpContext for accessing request/response

## Running the Example

\`\`\`bash
npm install
npm run dev
\`\`\`

The API will be available at http://localhost:3000

## API Endpoints

- \`GET /api/users\` - Get all users
- \`GET /api/users/:id\` - Get user by ID
- \`POST /api/users\` - Create new user
- \`PUT /api/users/:id\` - Update user (full)
- \`PATCH /api/users/:id\` - Update user (partial)
- \`DELETE /api/users/:id\` - Delete user

## OpenAPI Documentation

Access the auto-generated OpenAPI spec at:
- \`GET /api-docs\`
