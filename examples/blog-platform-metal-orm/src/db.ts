import sqlite3 from "sqlite3";
import { open as sqliteOpen } from "sqlite";
import {
  Orm, OrmSession, SqliteDialect,
  bootstrapEntities,
  createSqliteExecutor,
} from "metal-orm";

let orm: Orm | null = null;
let session: OrmSession | null = null;

export async function initDatabase(): Promise<OrmSession> {
  const db = await sqliteOpen({
    filename: ":memory:",
    driver: sqlite3.Database,
  });

  await createSchema(db);
  await seedData(db);

  const executor = createSqliteExecutor(db);

  orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {
        await db.close();
      },
    },
  });

  bootstrapEntities();
  session = new OrmSession({ orm, executor })
    .withSaveGraphDefaults({ coerce: "json", transactional: false, flush: true });

  return session;
}

export function getSession(): OrmSession {
  if (!session) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return session;
}

async function createSchema(db: any): Promise<void> {
  const statements = [
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      bio TEXT,
      createdAt TEXT NOT NULL
    )`,
    `CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT
    )`,
    `CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6B7280'
    )`,
    `CREATE TABLE blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorId INTEGER NOT NULL,
      categoryId INTEGER,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      publishedAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (authorId) REFERENCES users(id),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    )`,
    `CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      authorId INTEGER NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (postId) REFERENCES blog_posts(id),
      FOREIGN KEY (authorId) REFERENCES users(id)
    )`,
    `CREATE TABLE post_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      FOREIGN KEY (postId) REFERENCES blog_posts(id),
      FOREIGN KEY (tagId) REFERENCES tags(id)
    )`,
  ];

  for (const sql of statements) {
    await db.run(sql);
  }
}

async function seedData(db: any): Promise<void> {
  const statements = [
    `INSERT INTO users (email, name, bio, createdAt) VALUES ('alice@example.com', 'Alice Johnson', 'Tech writer', datetime('now'))`,
    `INSERT INTO users (email, name, bio, createdAt) VALUES ('bob@example.com', 'Bob Smith', 'Full-stack developer', datetime('now'))`,
    `INSERT INTO categories (name, slug, description) VALUES ('Technology', 'technology', 'Tech articles')`,
    `INSERT INTO categories (name, slug, description) VALUES ('Lifestyle', 'lifestyle', 'Lifestyle content')`,
    `INSERT INTO tags (name, color) VALUES ('typescript', '#3178C6')`,
    `INSERT INTO tags (name, color) VALUES ('javascript', '#F7DF1E')`,
    `INSERT INTO blog_posts (authorId, categoryId, title, content, status, publishedAt, createdAt) VALUES (1, 1, 'Getting Started with Metal-ORM', 'Metal-orm is a powerful ORM for TypeScript...', 'published', datetime('now'), datetime('now'))`,
    `INSERT INTO blog_posts (authorId, title, content, status, createdAt) VALUES (1, 'Building APIs', 'Learn how to build APIs...', 'draft', datetime('now'))`,
    `INSERT INTO post_tags (postId, tagId) VALUES (1, 1)`,
    `INSERT INTO post_tags (postId, tagId) VALUES (1, 2)`,
    `INSERT INTO comments (postId, authorId, content, createdAt) VALUES (1, 2, 'Great article!', datetime('now'))`,
  ];

  for (const sql of statements) {
    await db.run(sql);
  }
}
