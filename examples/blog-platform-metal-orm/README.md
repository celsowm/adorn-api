# Blog Platform Example (Metal-ORM)

A complete blog platform API using **metal-orm** with SQLite in-memory database and **adorn-api** for automatic OpenAPI documentation.

## Features

- **Metal-ORM Decorators**: `@Entity`, `@Column`, `@PrimaryKey`, `@HasMany`, `@BelongsTo`, `@BelongsToMany`
- **Type-Safe Column Definitions**: Using `col.*` type factories
- **Explicit Relationships**: Full relationship definitions between entities
- **Automatic OpenAPI Schema**: Entities are automatically converted to OpenAPI schemas using `registerMetalEntities()`
- **Type-Safe Queries**: Full TypeScript inference with `selectFromEntity()`, `entityRef()`, and `eq()`
- **Many-to-Many Relationships**: BlogPosts and Tags with pivot table
- **Relations**: Users have BlogPosts, BlogPosts have Comments, BlogPosts belong to Categories
- **Graph Helpers**: `saveGraphAndFlush()` and `updateGraph()` with session defaults

## Entities

### User
- `id` (INT, auto-increment, primary key)
- `email` (varchar(255), unique, not null)
- `name` (varchar(255), not null)
- `bio` (text, nullable)
- `createdAt` (timestamp, not null)
- Relations: `posts`, `comments`

### BlogPost (blog_posts table)
- `id` (INT, auto-increment, primary key)
- `authorId` (INT, foreign key to User)
- `categoryId` (INT, foreign key to Category, nullable)
- `title` (varchar(255), not null)
- `content` (text, not null)
- `status` (varchar(20), default: 'draft')
- `publishedAt` (timestamp, nullable)
- `createdAt` (timestamp, not null)
- Relations: `author`, `category`, `comments`, `tags`

### Comment
- `id` (INT, auto-increment, primary key)
- `postId` (INT, foreign key to BlogPost)
- `authorId` (INT, foreign key to User)
- `content` (text, not null)
- `createdAt` (timestamp, not null)
- Relations: `post`, `author`

### Category
- `id` (INT, auto-increment, primary key)
- `name` (varchar(255), unique, not null)
- `slug` (varchar(255), unique, not null)
- `description` (text, nullable)
- Relations: `posts`

### Tag
- `id` (INT, auto-increment, primary key)
- `name` (varchar(255), unique, not null)
- `color` (varchar(20), default: '#6B7280')
- Relations: `posts` (many-to-many via PostTag)

### PostTag (Pivot Table)
- `id` (INT, auto-increment, primary key)
- `postId` (INT, foreign key to BlogPost)
- `tagId` (INT, foreign key to Tag)
- Relations: `post`, `tag`

## API Endpoints

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Blog Posts
- `GET /api/blog-posts` - List all posts with optional filtering (supports deep-object `where` filters)
- `GET /api/blog-posts/:id` - Get post by ID
- `POST /api/blog-posts` - Create post
- `PUT /api/blog-posts/:id` - Update post
- `DELETE /api/blog-posts/:id` - Delete post

### Comments
- `GET /api/comments/post/:postId` - Get comments for a post
- `GET /api/comments` - List all comments
- `GET /api/comments/:id` - Get comment by ID
- `POST /api/comments/post/:postId` - Create comment for a post
- `DELETE /api/comments/:id` - Delete comment

### Categories
- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create category
- `DELETE /api/categories/:id` - Delete category

### Tags
- `GET /api/tags` - List all tags
- `GET /api/tags/:id` - Get tag by ID
- `POST /api/tags` - Create tag
- `DELETE /api/tags/:id` - Delete tag

## Quick Start

```bash
# From the project root
npm run example blog-platform-metal-orm

# Then open http://localhost:3000/docs
```

## Manual Setup

```bash
# Install dependencies
cd examples/blog-platform-metal-orm
npm install

# Build TypeScript & generate .adorn artifacts
npm run build

# Start development server with hot-reload
npm run dev

# Start production server
npm run start
```

## Database Schema

The database is automatically created from metal-orm entity decorators using `bootstrapEntities()`.

### Seed Data

The following data is automatically seeded on startup:

**Users:**
- Alice Johnson (alice@example.com)
- Bob Smith (bob@example.com)

**Categories:**
- Technology
- Lifestyle

**Tags:**
- TypeScript (blue)
- JavaScript (yellow)

**Posts:**
- "Getting Started with Metal-ORM" by Alice (published)
- "Building APIs" by Alice (draft)

**Comments:**
- "Great article!" by Bob on the first post

## Key Patterns

### Entity Definition with Type-Safe Columns

```typescript
import { Entity, Column, PrimaryKey, HasMany, BelongsTo } from "metal-orm";
import type { HasManyCollection } from "metal-orm";
import { BlogPost } from "./BlogPost.js";

@Entity()
export class User {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "varchar", args: [255], notNull: true, unique: true })
  email!: string;

  @Column({ type: "varchar", args: [255], notNull: true })
  name!: string;

  @Column({ type: "text" })
  bio?: string;

  @HasMany({ target: () => BlogPost, foreignKey: "authorId" })
  posts!: HasManyCollection<BlogPost>;
}
```

### Type-Safe Queries with metal-orm

```typescript
import { selectFromEntity, entityRef, eq } from "metal-orm";

const session = getSession();
const U = entityRef(User);

const [users] = await selectFromEntity(User)
  .select("id", "email", "name", "bio", "createdAt")
  .where(eq(U.id, 1))
  .executePlain(session);
```

### Deep Query Filtering (deepObject)

Use `@QueryStyle({ style: "deepObject" })` to opt into nested query objects on your primary get route:

```typescript
@Get("/")
@QueryStyle({ style: "deepObject" })
async getPosts(where?: {
  author?: { id?: number; email?: string };
  category?: { id?: number; slug?: string };
  tags?: { name?: string };
  status?: { eq?: string };
}) {
  return where;
}
```

Example requests:
- `GET /api/blog-posts?where[author][email]=alice@example.com`
- `GET /api/blog-posts?where[tags][name]=TypeScript&where[status][eq]=published`
- `GET /api/blog-posts?where[comments][author][name]=Ali` (partial search matches “Alice”)
- `GET /api/blog-posts?where[category][slug]=technology&where[author][id]=1`

### Persist and Flush

```typescript
const session = getSession();
const user = new User();
user.email = "new@example.com";
user.name = "New User";
user.createdAt = new Date();

await session.persist(user);
await session.flush();
```

### Graph Helpers (Save/Update)

```typescript
const session = getSession();

const post = await session.saveGraphAndFlush(BlogPost, {
  title: "New Post",
  content: "Hello!",
  authorId: 1,
  status: "draft",
  createdAt: new Date()
});

const updated = await session.updateGraph(BlogPost, {
  id: post.id,
  status: "published",
  publishedAt: new Date()
});
```

### Graph Defaults (Session-Wide)

```typescript
const session = new OrmSession({ orm, executor })
  .withSaveGraphDefaults({ coerce: "json", transactional: false, flush: true });
```

### Find and Update

```typescript
const session = getSession();
const user = await session.find(User, 1);
if (user) {
  user.name = "Updated Name";
  await session.flush();
}
```

### Many-to-Many Relations

```typescript
const post = await session.find(BlogPost, 1);
await post.tags.attach(tag1);
await post.tags.detach(tag1);
await session.flush();
```

### OpenAPI Integration

```typescript
import { registerMetalEntities } from "adorn-api/metal";
import { User, BlogPost, Comment, Category, Tag } from "./entities/index.js";

registerMetalEntities(openapi, [User, BlogPost, Comment, Category, Tag], {
  mode: "read",
  stripEntitySuffix: true,
  includeRelations: "inline",
});
```

## Project Structure

```
blog-platform-metal-orm/
├── src/
│   ├── entities/
│   │   ├── index.ts         # Export all entities
│   │   ├── User.ts
│   │   ├── BlogPost.ts
│   │   ├── Comment.ts
│   │   ├── Category.ts
│   │   ├── Tag.ts
│   │   └── PostTag.ts
│   ├── controllers/
│   │   ├── index.ts
│   │   ├── UsersController.ts
│   │   ├── BlogPostsController.ts
│   │   ├── CommentsController.ts
│   │   ├── CategoriesController.ts
│   │   └── TagsController.ts
│   ├── db.ts                # Database setup + seed data using metal-orm
│   └── server.ts            # Express server + adorn-api bootstrap
├── README.md
├── package.json
└── tsconfig.json
```
