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
    `create table categories (
      id integer primary key autoincrement,
      name text not null,
      parentId integer,
      lft integer not null,
      rght integer not null,
      depth integer,
      foreign key(parentId) references categories(id)
    )`
  );

  await execSql(
    db,
    `insert into categories (id, name, parentId, lft, rght, depth) values
      (1, 'Electronics', null, 1, 10, 0),
      (2, 'Computers', 1, 2, 5, 1),
      (3, 'Laptops', 2, 3, 4, 2),
      (4, 'Phones', 1, 6, 9, 1),
      (5, 'Smartphones', 4, 7, 8, 2)
    `
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
