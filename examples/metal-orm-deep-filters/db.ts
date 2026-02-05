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

function closeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export async function initializeDatabase() {
  db = new sqlite3.Database(":memory:");
  await execSql(db, "pragma foreign_keys = ON");

  await execSql(
    db,
    "create table alphas (id integer primary key autoincrement, name text not null)"
  );
  await execSql(
    db,
    "create table bravos (id integer primary key autoincrement, code text not null, alphaId integer not null, foreign key(alphaId) references alphas(id))"
  );
  await execSql(
    db,
    "create table deltas (id integer primary key autoincrement, name text not null)"
  );
  await execSql(
    db,
    "create table charlies (id integer primary key autoincrement, score integer not null, bravoId integer not null, deltaId integer, foreign key(bravoId) references bravos(id), foreign key(deltaId) references deltas(id))"
  );

  await execSql(db, `
    INSERT INTO alphas (name) VALUES
      ('Alpha One'),
      ('Alpha Two');
  `);

  await execSql(db, `
    INSERT INTO bravos (code, alphaId) VALUES
      ('BR-RED', 1),
      ('BR-BLUE', 1),
      ('BR-GREEN', 2);
  `);

  await execSql(db, `
    INSERT INTO deltas (name) VALUES
      ('Delta Core'),
      ('Delta Edge');
  `);

  await execSql(db, `
    INSERT INTO charlies (score, bravoId, deltaId) VALUES
      (95, 1, 1),
      (60, 1, NULL),
      (88, 2, 2),
      (70, 3, 1);
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
    throw new Error("ORM not initialized.");
  }
  return orm.createSession();
}

export async function disposeDatabase(): Promise<void> {
  await orm?.dispose();
  await closeDb();
  orm = null;
  db = null;
}
