import sqlite3 from 'sqlite3';

import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type DbExecutorFactory,
  type OrmSession
} from 'metal-orm';

import { AuthorEntity, PostEntity } from './relations.contracts.js';

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

const createAuthorsTableSql = `
  CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`;

const createPostsTableSql = `
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorId INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (authorId) REFERENCES authors(id)
  );
`;

const seedAuthors = async (session: OrmSession): Promise<void> => {
  const now = new Date().toISOString();

  const ada = await session.saveGraph(AuthorEntity, {
    name: 'Ada Lovelace',
    createdAt: now
  });
  await session.saveGraph(PostEntity, {
    authorId: ada.id,
    title: 'Notes on the Analytical Engine',
    body: 'First program',
    createdAt: now
  });
  await session.saveGraph(PostEntity, {
    authorId: ada.id,
    title: 'Foundations',
    body: 'Math and logic',
    createdAt: now
  });

  const grace = await session.saveGraph(AuthorEntity, {
    name: 'Grace Hopper',
    createdAt: now
  });
  await session.saveGraph(PostEntity, {
    authorId: grace.id,
    title: 'Compilers',
    body: 'COBOL era',
    createdAt: now
  });
};

export const initExampleDatabase = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      const session = orm.createSession();
      try {
        await session.executor.executeSql(createAuthorsTableSql);
        await session.executor.executeSql(createPostsTableSql);
        await seedAuthors(session);
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
