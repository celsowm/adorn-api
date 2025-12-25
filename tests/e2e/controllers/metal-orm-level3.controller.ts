import { MetalOrmCrudController, MetalOrmCrudBase, zodSchemaProvider } from '../../../src/index.js';
import {
  Entity,
  Column,
  PrimaryKey,
  col,
  Orm,
  SqliteDialect,
  createSqliteExecutor,
} from 'metal-orm';
import sqlite3 from 'sqlite3';
import { SqlitePromiseClient } from './helpers/sqlite-client.js';

const nameSchema = zodSchemaProvider.minLength
  ? zodSchemaProvider.minLength(zodSchemaProvider.string(), 1)
  : zodSchemaProvider.string();
const emailSchema = zodSchemaProvider.email
  ? zodSchemaProvider.email(zodSchemaProvider.string())
  : zodSchemaProvider.string();

@Entity({
  hooks: {
    beforeInsert(_ctx, entity) {
      const user = entity as User;
      user.name = user.name.trim();
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
      if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
      }
    },
    beforeUpdate(_ctx, entity) {
      const user = entity as User;
      user.name = user.name.trim();
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
    },
  },
})
class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.unique(col.varchar(255)))
  email?: string | null;

  @Column(col.timestamp())
  createdAt?: string | null;
}

@MetalOrmCrudController({
  basePath: '/metal-orm-decorator-users',
  target: User,
  select: ['id', 'name', 'email', 'createdAt'],
  search: { fields: ['name', 'email'] },
  create: { fields: ['name', 'email'] },
  update: { fields: ['name', 'email'] },
  notFoundMessage: 'User not found',
  schemaProvider: zodSchemaProvider,
  schemaOverrides: {
    body: {
      name: nameSchema,
      email: emailSchema,
    },
  },
})
export class MetalOrmDecoratorUsersController extends MetalOrmCrudBase {
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
        email TEXT UNIQUE,
        createdAt TEXT
      )
    `);

    await this.withSession(async (session) => {
      const alice = new User();
      alice.name = 'Alice';
      alice.email = 'alice@example.com';

      const bob = new User();
      bob.name = 'Bob';
      bob.email = 'bob@example.com';

      await session.persist(alice);
      await session.persist(bob);
      await session.commit();
    });
  }

  private runSql(sql: string, params: unknown[] = []): Promise<void> {
    return this.sqliteClient.run(sql, params);
  }
}
