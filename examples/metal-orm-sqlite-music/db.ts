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
    "create table artists (id integer primary key autoincrement, name text not null, genre text, country text, formedYear integer, createdAt text not null)"
  );
  await execSql(
    db,
    "create table albums (id integer primary key autoincrement, title text not null, releaseYear integer, artistId integer not null, createdAt text not null, foreign key(artistId) references artists(id))"
  );
  await execSql(
    db,
    "create table tracks (id integer primary key autoincrement, title text not null, durationSeconds integer, trackNumber integer, albumId integer not null, createdAt text not null, foreign key(albumId) references albums(id))"
  );

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
