# Blog Platform Example

A complete blog platform API using metal-orm decorators with SQLite in-memory database and adorn-api for automatic OpenAPI documentation.

## Features

- **Metal-ORM Decorators**: `@Entity`, `@Column`, `@PrimaryKey`, `@HasMany`, `@BelongsTo`, `@BelongsToMany`
- **Automatic OpenAPI Schema**: Entities are automatically converted to OpenAPI schemas using `registerMetalEntities()`
- **Type-Safe Queries**: Full TypeScript inference with `selectFromEntity()` and `entityRef()`
- **Many-to-Many Relationships**: Posts and Tags with pivot table
- **Relations**: Users have Posts, Posts have Comments, Posts belong to Categories

## Entities

### User
- `id` (UUID, primary key)
- `email` (varchar, unique, not null)
- `name` (varchar, not null)
- `bio` (text, nullable)
- `createdAt` (timestamp, not null)
- Relations: `posts`, `comments`

### Post
- `id` (UUID, primary key)
- `authorId` (UUID, foreign key to User)
- `categoryId` (UUID, foreign key to Category, nullable)
- `title` (varchar, not null)
- `content` (text, not null)
- `status` (varchar, default: 'draft')
- `publishedAt` (timestamp, nullable)
- `createdAt` (timestamp, not null)
- Relations: `author`, `category`, `comments`, `tags`

### Comment
- `id` (UUID, primary key)
- `postId` (UUID, foreign key to Post)
- `authorId` (UUID, foreign key to User)
- `content` (text, not null)
- `createdAt` (timestamp, not null)
- Relations: `post`, `author`

### Category
- `id` (UUID, primary key)
- `name` (varchar, unique, not null)
- `slug` (varchar, unique, not null)
- `description` (text, nullable)
- Relations: `posts`

### Tag
- `id` (UUID, primary key)
- `name` (varchar, unique, not null)
- `color` (varchar, default: '#6B7280')
- Relations: `posts` (many-to-many via PostTag)

### PostTag (Pivot Table)
- `id` (UUID, primary key)
- `postId` (UUID, foreign key to Post)
- `tagId` (UUID, foreign key to Tag)

## API Endpoints

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Posts
- `GET /api/posts` - List all posts with optional filtering
- `GET /api/posts/:id` - Get post by ID
- `POST /api/posts` - Create post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Comments
- `GET /api/posts/:postId/comments` - Get comments for a post
- `POST /api/posts/:postId/comments` - Create comment for a post
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

### Categories
- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Tags
- `GET /api/tags` - List all tags
- `GET /api/tags/:id` - Get tag by ID
- `POST /api/tags` - Create tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag
- `POST /api/posts/:postId/tags/:tagId` - Add tag to post
- `DELETE /api/posts/:postId/tags/:tagId` - Remove tag from post

## Quick Start

```bash
# From the project root
npm run example blog-platform

# Then open http://localhost:3000/docs
```

## Manual Setup

```bash
# Install dependencies
cd examples/blog-platform
npm install

# Build TypeScript & generate .adorn artifacts
npm run build

# Start development server with hot-reload
npm run dev

# Start production server
npm run start
```

## Database Schema

The database is automatically created from metal-orm entity decorators using `bootstrapEntities()` and `executeSchemaSqlFor()`.

### Seed Data

The following data is automatically seeded on startup:

**Users:**
- Alice Johnson (alice@example.com)
- Bob Smith (bob@example.com)

**Categories:**
- Technology
- Lifestyle
- Education

**Tags:**
- TypeScript (blue)
- JavaScript (yellow)
- SQL (green)
- Architecture (purple)

**Posts:**
- "Getting Started with Metal-ORM" by Alice (published)
- "Building APIs with adorn-api" by Alice (draft)

**Comments:**
- "Great article!" by Bob on the first post

## Key Patterns

### Entity Definition with Decorators

```typescript
import { Entity, Column, PrimaryKey, HasMany, BelongsTo } from "metal-orm/decorators";

@Entity()
export class User {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar", length: 255, notNull: true, unique: true })
  email!: string;

  @HasMany(() => Post, "authorId")
  posts?: Post[];
}
```

### Simple Insert for Seeding

```typescript
const executeInsert = async (builder: ReturnType<typeof insertInto>) => {
  const compiled = builder.compile(session.dialect);
  await session.executor.executeSql(compiled.sql, compiled.params);
};

await executeInsert(
  insertInto(User).values({
    id: "usr_001",
    email: "alice@example.com",
    name: "Alice Johnson",
  })
);
```

### Type-Safe Queries

```typescript
const U = entityRef(User);
const [user] = await selectFromEntity(User)
  .where(eq(U.id, "usr_001"))
  .execute(session);
```

### Save with Relations

```typescript
const session = orm.createSession();
const [post] = await saveGraph(session, Post, {
  title: "New Post",
  content: "Post content",
  authorId: "usr_001",
} as any);
await session.flush();
```

### OpenAPI Integration

```typescript
import { registerMetalEntities } from "adorn-api/metal";

registerMetalEntities(openapi, [User, Post, Comment, Category, Tag], {
  mode: "read",
  stripEntitySuffix: true,
  includeRelations: "inline",
});
```

## Project Structure

```
blog-platform/
├── src/
│   ├── entities/
│   │   ├── index.ts         # Export all entities
│   │   ├── User.ts
│   │   ├── Post.ts
│   │   ├── Comment.ts
│   │   ├── Category.ts
│   │   ├── Tag.ts
│   │   └── PostTag.ts
│   ├── controllers/
│   │   ├── index.ts
│   │   ├── UsersController.ts
│   │   ├── PostsController.ts
│   │   ├── CommentsController.ts
│   │   ├── CategoriesController.ts
│   │   └── TagsController.ts
│   ├── db.ts                # Database setup + seed data
│   └── server.ts            # Express server + adorn-api bootstrap
├── README.md
├── package.json
└── tsconfig.json
```
