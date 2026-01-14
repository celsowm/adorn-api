import "reflect-metadata";
import express from "express";
import Database from "sqlite3";
import { z } from "zod";
import {
  Controller,
  Get,
  Delete,
  ExpressAdapter,
  OpenApiGenerator,
  setupSwaggerUi,
  Params,
  Body,
  List,
  Create,
  Update,
  HttpError,
  EntitySchemaBuilder,
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
let session: any;

async function initializeDatabase() {
  await new Promise<void>((resolve, reject) => {
    db.run(
      `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        published BOOLEAN NOT NULL DEFAULT 0,
        authorId INTEGER NOT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  session = orm.createSession();
}

async function main() {
  await initializeDatabase();

  const CreateUserSchema = EntitySchemaBuilder.create(User);
  const UpdateUserSchema = EntitySchemaBuilder.update(User);
  const IdParamsSchema = EntitySchemaBuilder.idParams(User);
  const CreatePostSchema = EntitySchemaBuilder.create(PostModel);
  const userResponseSchema = EntitySchemaBuilder.response(User);
  const postResponseSchema = EntitySchemaBuilder.response(PostModel);

  @Controller("/users")
  class UserController {
    @List({
      entity: User,
      schema: userResponseSchema,
    })
    async getAll() {
      const users = await selectFromEntity(User)
        .select("id", "name", "email", "role", "createdAt")
        .execute(session);
      return users;
    }

    @Get("/:id")
    @Params(IdParamsSchema)
    async getById(params: z.infer<typeof IdParamsSchema>) {
      const users = await selectFromEntity(User)
        .select("id", "name", "email", "role", "createdAt")
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      if (!users || users.length === 0) {
        throw new HttpError(404, { error: "User not found" });
      }
      return users[0];
    }

    @Create()
    @Body(CreateUserSchema)
    async create(body: z.infer<typeof CreateUserSchema>) {
      try {
        const user = new User();
        user.name = body.name;
        user.email = body.email;
        user.role = body.role ?? "user";
        user.createdAt = new Date();
        await session.persist(user);
        await session.commit();
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        };
      } catch (e: any) {
        if (String(e?.message ?? "").includes("UNIQUE")) {
          throw new HttpError(409, { error: "Email already exists" });
        }
        throw e;
      }
    }

    @Update("/:id")
    @Params(IdParamsSchema)
    @Body(UpdateUserSchema)
    async update(
      params: z.infer<typeof IdParamsSchema>,
      body: z.infer<typeof UpdateUserSchema>,
    ) {
      const users = await selectFromEntity(User)
        .select("id", "name", "email", "role", "createdAt")
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      if (!users || users.length === 0) {
        throw new HttpError(404, { error: "User not found" });
      }
      const user = users[0];
      if (body.name !== undefined) user.name = body.name;
      if (body.email !== undefined) user.email = body.email;
      if (body.role !== undefined) user.role = body.role;
      await session.commit();
      return user;
    }

    @Delete("/:id")
    @Params(IdParamsSchema)
    async delete(params: z.infer<typeof IdParamsSchema>) {
      const users = await selectFromEntity(User)
        .select("id")
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      if (!users || users.length === 0) {
        throw new HttpError(404, { error: "User not found" });
      }
      await deleteFrom(User)
        .where(eq(entityRef(User).id, params.id))
        .execute(session);
      await session.commit();
      return { success: true };
    }
  }

  @Controller("/posts")
  class PostController {
    @List({
      entity: PostModel,
      schema: postResponseSchema,
    })
    async getAll() {
      const posts = await selectFromEntity(PostModel)
        .select("id", "title", "content", "published", "authorId", "createdAt")
        .execute(session);
      return posts;
    }

    @List("/published", {
      entity: PostModel,
      schema: postResponseSchema,
    })
    async getPublished() {
      const postTable = entityRef(PostModel);
      const posts = await selectFromEntity(PostModel)
        .select("id", "title", "content", "published", "authorId", "createdAt")
        .where(eq(getColumn(postTable, "published"), 1))
        .execute(session);
      return posts;
    }

    @Get("/:id")
    @Params(IdParamsSchema)
    async getById(params: z.infer<typeof IdParamsSchema>) {
      const posts = await selectFromEntity(PostModel)
        .select("id", "title", "content", "published", "authorId", "createdAt")
        .where(eq(entityRef(PostModel).id, params.id))
        .execute(session);
      if (!posts || posts.length === 0) {
        throw new HttpError(404, { error: "Post not found" });
      }
      return posts[0];
    }

    @Create()
    @Body(CreatePostSchema)
    async create(body: z.infer<typeof CreatePostSchema>) {
      const post = new PostModel();
      post.title = body.title;
      post.content = body.content;
      post.published = body.published ?? false;
      post.authorId = body.authorId;
      post.createdAt = new Date();
      await session.persist(post);
      await session.commit();
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        published: post.published,
        authorId: post.authorId,
        createdAt: post.createdAt,
      };
    }
  }

  const app = express();
  app.use(express.json());

  const adapter = new ExpressAdapter(app);
  adapter.registerController(UserController);
  adapter.registerController(PostController);
  adapter.registerErrorMiddleware();

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
  const server = app.listen(PORT, () => {
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

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await session?.dispose();
    server.close(() => {
      db.close();
      console.log("Server closed");
    });
  });

  process.on("SIGTERM", async () => {
    console.log("\nShutting down...");
    await session?.dispose();
    server.close(() => {
      db.close();
      console.log("Server closed");
    });
  });
}

main().catch(console.error);
