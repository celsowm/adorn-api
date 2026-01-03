import sqlite3 from "sqlite3";
import { open as sqliteOpen } from "sqlite";
import {
  Orm, OrmSession, SqliteDialect,
  bootstrapEntities,
  createSqliteExecutor,
} from "metal-orm";
import { Task } from "./entity.js";

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
      dispose: async () => { await db.close(); },
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
  await db.run(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    )
  `);
}

async function seedData(db: any): Promise<void> {
  const stmt = await db.prepare("INSERT INTO tasks (title, completed, createdAt) VALUES (?, ?, ?)");
  for (let i = 1; i <= 15; i++) {
    const completed = i % 3 === 0 ? 1 : 0;
    const createdAt = new Date(Date.now() + i * 60000).toISOString();
    await stmt.run(`Task ${i}`, completed, createdAt);
  }
  await stmt.finalize();
}
