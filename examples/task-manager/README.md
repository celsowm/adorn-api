# Task Manager Example

A complete task management API using SQLite3 in-memory database with raw SQL queries.

## Features

### Tasks
- **GET /api/tasks** - List all tasks with optional filtering
  - Query params: `status`, `priority`, `search`
- **GET /api/tasks/:id** - Get a specific task with tags
- **POST /api/tasks** - Create a new task
- **PUT /api/tasks/:id** - Update a task
- **DELETE /api/tasks/:id** - Delete a task
- **POST /api/tasks/:id/tags** - Add a tag to a task
- **DELETE /api/tasks/:id/tags/:tagId** - Remove a tag from a task

### Tags
- **GET /api/tags** - List all tags
- **POST /api/tags** - Create a new tag
- **DELETE /api/tags/:id** - Delete a tag

### Stats
- **GET /api/stats** - Get task statistics

## Quick Start

```bash
# From the project root
npm run example task-manager

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

## Database Schema

### Tasks Table
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### Tags Table
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280'
)
```

### Task Tags Junction Table
```sql
CREATE TABLE task_tags (
  task_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
)
```

## Testing the API

### Using Swagger UI

1. Open http://localhost:3000/docs
2. Try the "Try it out" button for each endpoint
3. Click "Execute" to send requests

### Using curl

```bash
# Get all tasks
curl http://localhost:3000/api/tasks

# Get tasks with filtering
curl "http://localhost:3000/api/tasks?status=in_progress&priority=high"

# Search tasks
curl "http://localhost:3000/api/tasks?search=authentication"

# Get specific task
curl http://localhost:3000/api/tasks/1

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review Pull Request",
    "description": "Review and approve the PR for the new feature",
    "status": "pending",
    "priority": "high",
    "due_date": "2025-01-22T00:00:00.000Z"
  }'

# Update a task
curl -X PUT http://localhost:3000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'

# Delete a task
curl -X DELETE http://localhost:3000/api/tasks/1

# Get all tags
curl http://localhost:3000/api/tags

# Create a tag
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -d '{"name": "review", "color": "#8B5CF6"}'

# Add tag to task
curl -X POST http://localhost:3000/api/tasks/1/tags \
  -H "Content-Type: application/json" \
  -d '{"tag_id": 1}'

# Get statistics
curl http://localhost:3000/api/stats
```

## Key Features Demonstrated

- **SQLite3 in-memory database** with raw SQL queries
- **Relational data modeling** with junction tables (many-to-many relationships)
- **Advanced filtering** with optional query parameters
- **Database seeding** with initial data
- **Full CRUD operations** on multiple entities
- **Cascade deletes** for maintaining referential integrity
- **Aggregation queries** for statistics
- **OpenAPI/Swagger documentation** auto-generated from TypeScript decorators
- **Type-safe API** with full TypeScript support

## Project Structure

```
├── src/
│   ├── controller.ts      # API controllers with decorators
│   └── db.ts              # Database setup and helper functions
├── .adorn/               # Generated artifacts
│   ├── openapi.json       # OpenAPI 3.1 spec
│   ├── manifest.json      # Runtime binding metadata
│   └── cache.json        # Build cache
├── server.ts             # Express server setup with database initialization
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies including sqlite3
```
