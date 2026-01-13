# Adorn-API + Metal-ORM Example

This example demonstrates Adorn-API's integration with Metal-ORM for full-stack type safety with real SQLite in-memory database.

## Features

- **Real SQLite in-memory database** - No external database setup required
- **Metal-ORM decorated entities** - Using @Entity() decorators
- **Metal-ORM session** - Proper session-based database operations
- **Type-safe CRUD operations** - Full Create, Read, Update, Delete operations
- **Zod validation** - Automatic request validation with Zod schemas
- **Entity-driven OpenAPI schema generation** - Auto-generate API documentation
- **Express integration** - Seamless integration with Express.js

## Entities

### User Entity

```typescript
@Entity()
export class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.varchar(255))
  email!: string;

  @Column(col.varchar(50))
  role!: string;

  @Column(col.timestamp())
  createdAt!: Date;
}
```

### Post Entity

```typescript
@Entity()
export class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  title!: string;

  @Column(col.text())
  content!: string;

  @Column(col.boolean())
  published!: boolean;

  @Column(col.int())
  authorId!: number;

  @Column(col.timestamp())
  createdAt!: Date;
}
```

## Prerequisites

```bash
# Install dependencies
npm install
```

## Running

```bash
npm run dev
```

The server will start on `http://localhost:3000` with an in-memory SQLite database.

## Endpoints

### Users

| Method | Path       | Description    |
| ------ | ---------- | -------------- |
| GET    | /users     | List all users |
| GET    | /users/:id | Get user by ID |
| POST   | /users     | Create user    |
| PUT    | /users/:id | Update user    |
| DELETE | /users/:id | Delete user    |

### Posts

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| GET    | /posts           | List all posts       |
| GET    | /posts/published | List published posts |
| GET    | /posts/:id       | Get post by ID       |
| POST   | /posts           | Create post          |

## Metal-ORM Integration

### Session-based Operations

Each database operation uses a Metal-ORM session:

```typescript
@Get()
async getAll() {
  const session = orm.createSession();
  try {
    const users = await selectFromEntity(User)
      .select('id', 'name', 'email', 'role', 'createdAt')
      .execute(session);
    return users;
  } finally {
    await session.dispose();
  }
}
```

### Create Operations

```typescript
@Post()
@Body(CreateUserSchema)
async create(body: z.infer<typeof CreateUserSchema>) {
  const session = orm.createSession();
  try {
    const user = new User();
    user.name = body.name;
    user.email = body.email;
    user.role = body.role ?? 'user';
    user.createdAt = new Date();
    await session.persist(user);
    await session.commit();
    return user;
  } finally {
    await session.dispose();
  }
}
```

### Update Operations

```typescript
@Put('/:id')
@Params(IdParamsSchema)
@Body(UpdateUserSchema)
async update(params: z.infer<typeof IdParamsSchema>, body: z.infer<typeof UpdateUserSchema>) {
  const session = orm.createSession();
  try {
    const users = await selectFromEntity(User)
      .select('id', 'name', 'email', 'role', 'createdAt')
      .where(eq(entityRef(User).id, params.id))
      .execute(session);
    if (!users || users.length === 0) {
      return { error: 'User not found', status: 404 };
    }
    const user = users[0];
    if (body.name !== undefined) user.name = body.name;
    if (body.email !== undefined) user.email = body.email;
    if (body.role !== undefined) user.role = body.role;
    await session.commit();
    return user;
  } finally {
    await session.dispose();
  }
}
```

### Delete Operations

```typescript
@Delete('/:id')
@Params(IdParamsSchema)
async delete(params: z.infer<typeof IdParamsSchema>) {
  const session = orm.createSession();
  try {
    const users = await selectFromEntity(User)
      .select('id')
      .where(eq(entityRef(User).id, params.id))
      .execute(session);
    if (!users || users.length === 0) {
      return { error: 'User not found', status: 404 };
    }
    await deleteFrom(User)
      .where(eq(entityRef(User).id, params.id))
      .execute(session);
    return { success: true };
  } finally {
    await session.dispose();
  }
}
```

## Zod Validation

Schemas are defined using Zod for automatic request validation:

```typescript
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
});

const IdParamsSchema = z.object({
  id: z.coerce.number().positive(),
});
```

## OpenAPI Docs

Visit http://localhost:3000/api-docs to view the generated OpenAPI specification.

## Example Requests

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "role": "admin"}'

# List all users
curl http://localhost:3000/users

# Get user by ID
curl http://localhost:3000/users/1

# Update a user
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Updated"}'

# Delete a user
curl -X DELETE http://localhost:3000/users/1

# Create a post
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "My Post", "content": "Hello World", "authorId": 1}'

# List all posts
curl http://localhost:3000/posts

# List published posts
curl http://localhost:3000/posts/published
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Posts Table

```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT 0,
  authorId INTEGER NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (authorId) REFERENCES users(id)
)
```
