import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from "metal-orm";

let db: sqlite3.Database | null = null;
let orm: Orm | null = null;

function execSql(database: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    database.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function createSqliteClient(database: sqlite3.Database): SqliteClientLike {
  return {
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows as Record<string, unknown>[]);
        });
      });
    },
    beginTransaction() {
      return execSql(database, "BEGIN");
    },
    commitTransaction() {
      return execSql(database, "COMMIT");
    },
    rollbackTransaction() {
      return execSql(database, "ROLLBACK");
    }
  };
}

export async function initializeDatabase() {
  db = new sqlite3.Database(":memory:");
  await execSql(db, "pragma foreign_keys = ON");
  await execSql(
    db,
    "create table users (id integer primary key autoincrement, name text not null, email text, createdAt text not null)"
  );
  await execSql(
    db,
    "create table posts (id integer primary key autoincrement, title text not null, body text, userId integer not null, createdAt text not null, foreign key(userId) references users(id))"
  );

  await execSql(db, `
    INSERT INTO users (name, email, createdAt) VALUES 
      ('Alice', 'alice@example.com', '2026-01-17T00:00:00.000Z'),
      ('Bob', 'bob@example.com', '2026-01-17T00:00:00.000Z')
  `);

  await execSql(db, `
    INSERT INTO posts (title, body, userId, createdAt) VALUES 
      ('First Post', 'This is the first post content', 1, '2026-01-17T00:00:00.000Z'),
      ('Second Post', 'Another post here', 2, '2026-01-17T00:00:00.000Z'),
      ('Third Post', 'Yet another post', 1, '2026-01-17T00:00:00.000Z')
  `);

  const executor = createSqliteExecutor(createSqliteClient(db));
  orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {}
    }
  });
}

export function createSession() {
  if (!orm) {
    throw new Error("ORM not initialized");
  }
  return orm.createSession();
}
