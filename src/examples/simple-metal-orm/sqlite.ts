import sqlite3 from 'sqlite3';

import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  insertInto,
  type DbExecutorFactory,
  type OrmSession
} from 'metal-orm';

import { usersTable } from './entities.registry.js';

const db = new sqlite3.Database(':memory:');
const dialect = new SqliteDialect();

const runSql = (sql: string, params: unknown[] = []): Promise<void> =>
  new Promise((resolve, reject) => {
    db.run(sql, params, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

const sqliteClient = {
  all: (sql: string, params?: unknown[]) =>
    new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      db.all(sql, params ?? [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Array<Record<string, unknown>>);
      });
    }),
  run: (sql: string, params?: unknown[]) => runSql(sql, params ?? []),
  beginTransaction: () => runSql('BEGIN'),
  commitTransaction: () => runSql('COMMIT'),
  rollbackTransaction: () => runSql('ROLLBACK')
};

const executorFactory: DbExecutorFactory = {
  createExecutor: () => createSqliteExecutor(sqliteClient),
  createTransactionalExecutor: () => createSqliteExecutor(sqliteClient),
  dispose: async () =>
    new Promise<void>((resolve, reject) => {
      db.close(err => (err ? reject(err) : resolve()));
    })
};

const orm = new Orm({
  dialect,
  executorFactory
});

let initPromise: Promise<void> | null = null;

const createUsersTableSql = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`;

const seedUsers = async (session: OrmSession): Promise<void> => {
  const now = new Date().toISOString();
  const seedRows = [
    { nome: 'Ana', email: 'ana@example.com', status: 'active', createdAt: now },
    { nome: 'Bruno', email: 'bruno@example.com', status: 'locked', createdAt: now },
    { nome: 'Carla', email: 'carla@example.com', status: 'active', createdAt: now },
    { nome: 'Diego', email: 'diego@example.com', status: 'active', createdAt: now },
    { nome: 'Elisa', email: 'elisa@example.com', status: 'locked', createdAt: now }
  ];

  const insert = insertInto(usersTable).values(seedRows);
  const compiled = insert.compile(session.orm.dialect);
  await session.executor.executeSql(compiled.sql, compiled.params);
};

export const initExampleDatabase = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      const session = orm.createSession();
      try {
        await session.executor.executeSql(createUsersTableSql);
        await seedUsers(session);
      } finally {
        await session.dispose();
      }
    })();
  }
  return initPromise;
};

export const withSession = async <T>(fn: (session: OrmSession) => Promise<T>): Promise<T> => {
  await initExampleDatabase();
  const session = orm.createSession();
  try {
    return await fn(session);
  } finally {
    await session.dispose();
  }
};
