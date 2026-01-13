import express from "express";
import Database from "sqlite3";
import { z } from "zod";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  ExpressAdapter,
  OpenApiGenerator,
  setupSwaggerUi,
  Params,
  Body,
  Schema,
} from "adorn-api";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  bootstrapEntities,
  selectFromEntity,
  eq,
  entityRef,
  deleteFrom,
  getColumn,
} from "metal-orm";
import { User } from "./entities.js";
import { Post as PostModel } from "./entities.js";

const orm = new Orm({
  dialect: new SqliteDialect(),
  executorFactory: {
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => {},
  },
});

const db = new Database.Database(":memory:");

const sqliteClient = {
  all: (sql: string, params?: unknown[]) =>
    new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Record<string, unknown>[]);
      });
    }),
  run: (sql: string, params?: unknown[]) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    }),
};

const executor = createSqliteExecutor(sqliteClient);

async function initializeDatabase() {
  await new Promise<void>((resolve, reject) => {
    db.run(
      `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) DEFAULT 'user',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });

  await new Promise<void>((resolve, reject) => {
    db.run(
      `
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        published BOOLEAN DEFAULT 0,
        authorId INTEGER NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users(id)
      )
    `,
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });

  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO users (name, email, role, createdAt) VALUES 
        ('John Doe', 'john@example.com', 'admin', '2025-01-01 10:00:00'),
        ('Jane Smith', 'jane@example.com', 'user', '2025-01-02 14:30:00'),
        ('Bob Johnson', 'bob@example.com', 'user', '2025-01-03 09:15:00')`,
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });

  bootstrapEntities();
}

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

const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  published: z.boolean().optional(),
  authorId: z.number().positive(),
});

@Controller("/users")
class UserController {
  @Get()
  async getAll() {
    const session = orm.createSession();
    try {
      const users = await selectFromEntity(User)
        .select("id", "name", "email", "role", "createdAt")
        .execute(session);
      return users;
    } finally {
      await session.dispose();
    }
  }

  @Get("/:id")
  @Params(IdParamsSchema)
  async getById(params: z.infer<typeof IdParamsSchema>) {
    const session = orm.createSession();
    try {
      const users = await selectFromEntity(User)
        .select("id", "name", "email", "role", "createdAt")
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      if (!users || users.length === 0) {
        return { error: "User not found", status: 404 };
      }
      return users[0];
    } finally {
      await session.dispose();
    }
  }

  @Post()
  @Body(CreateUserSchema)
  async create(body: z.infer<typeof CreateUserSchema>) {
    const session = orm.createSession();
    try {
      const user = new User();
      user.name = body.name;
      user.email = body.email;
      user.role = body.role ?? "user";
      user.createdAt = new Date();
      await session.persist(user);
      await session.commit();
      return user;
    } finally {
      await session.dispose();
    }
  }

  @Put("/:id")
  @Schema({
    params: IdParamsSchema,
    body: UpdateUserSchema,
  })
  async update(input: {
    params: z.infer<typeof IdParamsSchema>;
    body: z.infer<typeof UpdateUserSchema>;
  }) {
    const session = orm.createSession();
    try {
      const users = await selectFromEntity(User)
        .select("id", "name", "email", "role", "createdAt")
        .where(eq(entityRef(User).id, input.params.id))
        .execute(session);
      if (!users || users.length === 0) {
        return { error: "User not found", status: 404 };
      }
      const user = users[0];
      if (input.body.name !== undefined) user.name = input.body.name;
      if (input.body.email !== undefined) user.email = input.body.email;
      if (input.body.role !== undefined) user.role = input.body.role;
      await session.commit();
      return user;
    } finally {
      await session.dispose();
    }
  }

  @Delete("/:id")
  @Params(IdParamsSchema)
  async delete(params: z.infer<typeof IdParamsSchema>) {
    const session = orm.createSession();
    try {
      const users = await selectFromEntity(User)
        .select("id")
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      if (!users || users.length === 0) {
        return { error: "User not found", status: 404 };
      }
      await deleteFrom(User)
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      return { success: true };
    } finally {
      await session.dispose();
    }
  }
}

@Controller("/posts")
class PostController {
  @Get()
  async getAll() {
    const session = orm.createSession();
    try {
      const posts = await selectFromEntity(PostModel)
        .select("id", "title", "content", "published", "authorId", "createdAt")
        .execute(session);
      return posts;
    } finally {
      await session.dispose();
    }
  }

  @Get("/published")
  async getPublished() {
    const session = orm.createSession();
    try {
      const postTable = entityRef(PostModel);
      const posts = await selectFromEntity(PostModel)
        .select("id", "title", "content", "published", "authorId", "createdAt")
        .where(eq(getColumn(postTable, "published"), 1))
        .execute(session);
      return posts;
    } finally {
      await session.dispose();
    }
  }

  @Get("/:id")
  @Params(IdParamsSchema)
  async getById(params: z.infer<typeof IdParamsSchema>) {
    const session = orm.createSession();
    try {
      const posts = await selectFromEntity(PostModel)
        .select("id", "title", "content", "published", "authorId", "createdAt")
        .where(eq(entityRef(PostModel).id, params.id))
        .execute(session);
      if (!posts || posts.length === 0) {
        return { error: "Post not found", status: 404 };
      }
      return posts[0];
    } finally {
      await session.dispose();
    }
  }

  @Post()
  @Body(CreatePostSchema)
  async create(body: z.infer<typeof CreatePostSchema>) {
    const session = orm.createSession();
    try {
      const post = new PostModel();
      post.title = body.title;
      post.content = body.content;
      post.published = body.published ?? false;
      post.authorId = body.authorId;
      post.createdAt = new Date();
      await session.persist(post);
      await session.commit();
      return post;
    } finally {
      await session.dispose();
    }
  }
}

async function main() {
  await initializeDatabase();

  const app = express();
  app.use(express.json());

  const adapter = new ExpressAdapter(app);
  adapter.registerController(UserController);
  adapter.registerController(PostController);

  const generator = new OpenApiGenerator();
  const openapi = generator.generateDocument({
    info: {
      title: "Adorn-API + Metal-ORM Example",
      version: "1.0.0",
      description:
        "Demonstrating smart decorators with Metal-ORM integration and SQLite in-memory database",
    },
    servers: [{ url: "http://localhost:3000", description: "Local server" }],
  });

  setupSwaggerUi(app, openapi);

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Swagger UI: http://localhost:${PORT}/swagger`);
    console.log(`   OpenAPI JSON: http://localhost:${PORT}/swagger.json`);
    console.log(``);
    console.log(`Endpoints:`);
    console.log(`  GET    /users              - List all users`);
    console.log(`  GET    /users/:id          - Get user by ID`);
    console.log(`  POST   /users              - Create user`);
    console.log(`  PUT    /users/:id          - Update user`);
    console.log(`  DELETE /users/:id          - Delete user`);
    console.log(`  GET    /posts              - List all posts`);
    console.log(`  GET    /posts/published    - List published posts`);
    console.log(`  GET    /posts/:id          - Get post by ID`);
    console.log(`  POST   /posts              - Create post`);
  });
}

main().catch(console.error);
