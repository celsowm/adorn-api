import { MetalOrmCrudController, MetalOrmCrudBase, simpleSchemaProvider } from '../../../src/index.js';
import {
  defineTable,
  col,
  Orm,
  SqliteDialect,
  createSqliteExecutor,
} from 'metal-orm';
import sqlite3 from 'sqlite3';
import { SqlitePromiseClient } from './helpers/sqlite-client.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
  email: col.varchar(255),
  createdAt: col.timestamp(),
});

users.columns.email.unique = true;

const nameSchema = simpleSchemaProvider.minLength!(simpleSchemaProvider.string(), 1);
const emailSchema = simpleSchemaProvider.email!(simpleSchemaProvider.string());

@MetalOrmCrudController({
  basePath: '/metal-orm-users',
  target: users,
  select: ['id', 'name', 'email', 'createdAt'],
  search: { fields: ['name', 'email'] },
  create: { fields: ['name', 'email'] },
  update: { fields: ['name', 'email'] },
  defaults: { createdAt: () => new Date().toISOString() },
  notFoundMessage: 'User not found',
  schemaProvider: simpleSchemaProvider,
  schemaOverrides: {
    body: {
      name: nameSchema,
      email: emailSchema,
    },
  },
})
export class MetalOrmUsersController extends MetalOrmCrudBase {
  protected readonly orm: Orm;
  protected readonly ready: Promise<void>;
  private readonly db: sqlite3.Database;
  private readonly sqliteClient: SqlitePromiseClient;

  constructor() {
    super();
    this.db = new sqlite3.Database(':memory:');
    this.sqliteClient = new SqlitePromiseClient(this.db);
    const dialect = new SqliteDialect();
    this.orm = new Orm({
      dialect,
      executorFactory: {
        createExecutor: () => createSqliteExecutor(this.sqliteClient),
        createTransactionalExecutor: () => createSqliteExecutor(this.sqliteClient),
        dispose: async () => {},
      },
    });
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.runSql(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        createdAt TEXT,
        UNIQUE(email)
      )
    `);

    const now = new Date().toISOString();
    await this.runSql(
      `
        INSERT INTO users (name, email, createdAt) VALUES
          ('Alice', 'alice@example.com', ?),
          ('Bob', 'bob@example.com', ?)
      `,
      [now, now],
    );
  }

  private runSql(sql: string, params: unknown[] = []): Promise<void> {
    return this.sqliteClient.run(sql, params);
  }
}
