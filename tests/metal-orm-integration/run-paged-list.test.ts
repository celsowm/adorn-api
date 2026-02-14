import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  col,
  createSqliteExecutor,
  defineTable,
  selectFrom,
  type SqliteClientLike
} from "metal-orm";
import { runPagedList } from "../../src/adapter/metal-orm/list";

const users = defineTable("users", {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.text()),
  email: col.notNull(col.text())
});

let db: sqlite3.Database | null = null;
let orm: Orm | null = null;

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
    }
  };
}

function execSql(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
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

describe("runPagedList integration", () => {
  beforeAll(async () => {
    db = new sqlite3.Database(":memory:");
    await execSql("create table users (id integer primary key autoincrement, name text not null, email text not null)");
    await execSql("insert into users (name, email) values ('Ada', 'ada@example.com')");
    await execSql("insert into users (name, email) values ('Alan', 'alan@example.com')");
    await execSql("insert into users (name, email) values ('Bruna', 'bruna@example.com')");

    const client = createSqliteClient(db);
    const executor = createSqliteExecutor(client);
    orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {}
      }
    });
  });

  afterAll(async () => {
    await orm?.dispose();
    await closeDb();
  });

  it("runs filtered + sorted + paginated list from raw query", async () => {
    if (!orm) {
      throw new Error("ORM not initialized");
    }

    const session = orm.createSession();
    try {
      const result = await runPagedList({
        query: {
          page: "1",
          pageSize: "1",
          nameContains: "a",
          sortBy: "name",
          sortOrder: "DESC"
        },
        target: users,
        qb: () => selectFrom(users).select("id", "name", "email"),
        session,
        filterMappings: {
          nameContains: { field: "name", operator: "contains" }
        },
        sortableColumns: {
          id: "id",
          name: "name"
        },
        defaultSortBy: "id",
        defaultSortDirection: "asc"
      });

      expect(result.totalItems).toBe(3);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Bruna");
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(1);
      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
    } finally {
      await session.dispose();
    }
  });

  it("supports defaults when sort/page params are omitted", async () => {
    if (!orm) {
      throw new Error("ORM not initialized");
    }

    const session = orm.createSession();
    try {
      const result = await runPagedList({
        query: {},
        target: users,
        qb: () => selectFrom(users).select("id", "name", "email"),
        session,
        filterMappings: {},
        sortableColumns: {
          id: "id"
        },
        defaultSortBy: "id",
        defaultSortDirection: "desc",
        defaultPageSize: 2,
        maxPageSize: 5
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe(3);
      expect(result.items[1].id).toBe(2);
      expect(result.pageSize).toBe(2);
      expect(result.totalItems).toBe(3);
    } finally {
      await session.dispose();
    }
  });
});
