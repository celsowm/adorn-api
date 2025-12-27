import sqlite3 from 'sqlite3';
import { Orm, OrmSession, SqliteDialect, bootstrapEntities, createSqliteExecutor } from 'metal-orm';
import type { Express } from 'express';
import { buildApp } from '../../src/index.js';
import { MetalOrmEntityController } from './controllers/metal-orm-entity.controller.js';
import {
  MetalOrmOrdersController,
  MetalOrmReportsController,
} from './controllers/metal-orm-orders.controller.js';
import './entities.js';

type TestApp = {
  app: Express;
  close: () => Promise<void>;
};

export async function createTestApp(): Promise<TestApp> {
  const db = new sqlite3.Database(':memory:');

  const execSql = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => {
      db.exec(sql, (err) => (err ? reject(err) : resolve()));
    });

  const runSql = (sql: string, params: unknown[] = []): Promise<void> =>
    new Promise((resolve, reject) => {
      db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });

  const all = (sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) =>
        err ? reject(err) : resolve(rows as Record<string, unknown>[])
      );
    });

  await execSql(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      active INTEGER NOT NULL
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await runSql('INSERT INTO users (id, name, email, active) VALUES (?, ?, ?, ?)', [
    1,
    'Ada',
    'ada@example.com',
    0,
  ]);
  await runSql('INSERT INTO posts (id, user_id, title) VALUES (?, ?, ?)', [10, 1, 'Hello']);
  await runSql('INSERT INTO posts (id, user_id, title) VALUES (?, ?, ?)', [11, 1, 'World']);
  await runSql('INSERT INTO orders (id, user_id, total, status) VALUES (?, ?, ?, ?)', [
    201,
    1,
    99.5,
    'open',
  ]);
  await runSql('INSERT INTO orders (id, user_id, total, status) VALUES (?, ?, ?, ?)', [
    202,
    1,
    49.25,
    'processing',
  ]);

  const executor = createSqliteExecutor({
    all,
    beginTransaction: () => execSql('BEGIN'),
    commitTransaction: () => execSql('COMMIT'),
    rollbackTransaction: () => execSql('ROLLBACK'),
  });

  const orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {},
    },
  });

  bootstrapEntities();

  const session = new OrmSession({ orm, executor });
  const app = buildApp(
    [MetalOrmEntityController, MetalOrmOrdersController, MetalOrmReportsController],
    {
      resolveController: (ctor) => {
        if (ctor === MetalOrmEntityController) return new MetalOrmEntityController(session);
        if (ctor === MetalOrmOrdersController) return new MetalOrmOrdersController(session);
        if (ctor === MetalOrmReportsController) return new MetalOrmReportsController(session);
        return new (ctor as any)();
      },
    }
  );

  return {
    app,
    close: async () => {
      await session.dispose();
      await new Promise<void>((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
