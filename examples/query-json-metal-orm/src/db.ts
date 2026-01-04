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
      name TEXT NOT NULL
    )`,
        `CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authorId INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      FOREIGN KEY (authorId) REFERENCES users(id)
    )`,
    ];

    for (const sql of statements) {
        await db.run(sql);
    }
}

async function seedData(db: any): Promise<void> {
    const userResult = await db.run(`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`);
    const aliceId = userResult.lastID;

    await db.run(`INSERT INTO posts (authorId, title, content, status) VALUES (?, ?, ?, ?)`,
        [aliceId, "Adorn-API is Awesome", "JSON query filters are great.", "published"]);

    await db.run(`INSERT INTO posts (authorId, title, content, status) VALUES (?, ?, ?, ?)`,
        [aliceId, "Metal ORM Integration", "It works seamlessly with decorators.", "draft"]);
}
