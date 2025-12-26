import {
  MetalOrmCrudController,
  type RequestContext,
  simpleSchemaProvider,
  NotFoundError,
  RouteConfigError,
} from '../../../src/index.js';
import {
  Entity,
  Column,
  PrimaryKey,
  Orm,
  col,
  count,
  createSqliteExecutor,
  eq,
  esel,
  getTableDefFromEntity,
  selectFromEntity,
  SqliteDialect,
  bootstrapEntities,
  and,
} from 'metal-orm';
import type { ExpressionNode, OrmSession, TableDef } from 'metal-orm';
import sqlite3 from 'sqlite3';
import { SqlitePromiseClient } from './helpers/sqlite-client.js';

type PartialStringRecord = Record<string, unknown>;
type UserCreateBody = {
  name: string;
  email?: string | null;
};
type UserUpdateBody = {
  name?: string;
  email?: string | null;
};

const nameSchema = simpleSchemaProvider.minLength!(simpleSchemaProvider.string(), 1);
const emailSchema = simpleSchemaProvider.email!(simpleSchemaProvider.string());

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

bootstrapEntities();

@MetalOrmCrudController({
  basePath: '/metal-orm-decorator-flexible-users',
  target: User,
  select: ['id', 'name', 'email', 'createdAt'],
  search: { fields: ['name', 'email'] },
  create: { fields: ['name', 'email'] },
  update: { fields: ['name', 'email'] },
  notFoundMessage: 'User not found',
  schemaProvider: simpleSchemaProvider,
  schemaOverrides: {
    body: {
      name: nameSchema,
      email: emailSchema,
    },
  },
})
export class MetalOrmFlexibleUsersController {
  protected readonly orm: Orm;
  protected readonly ready: Promise<void>;
  private readonly db: sqlite3.Database;
  private readonly sqliteClient: SqlitePromiseClient;
  private readonly table: TableDef;
  private readonly selection = esel(User, 'id', 'name', 'email', 'createdAt');
  private readonly searchFields = ['name', 'email'];

  constructor() {
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

    const table = getTableDefFromEntity(User);
    if (!table) {
      throw new RouteConfigError('User table metadata is not available');
    }
    this.table = table;
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

  private createSession(): OrmSession {
    return this.orm.createSession();
  }

  private async withSession<T>(fn: (session: OrmSession) => Promise<T>): Promise<T> {
    const session = this.createSession();
    try {
      return await fn(session);
    } finally {
      await session.dispose();
    }
  }

  private formatUser(user: unknown): Record<string, unknown> {
    const record = user as Record<string, unknown>;
    const idValue = record.id;
    const name = typeof record.name === 'string' ? record.name : '';
    const emailRaw = record.email;
    const email = typeof emailRaw === 'string' ? emailRaw : emailRaw ?? null;
    const createdAtRaw = record.createdAt;
    const createdAt =
      typeof createdAtRaw === 'string'
        ? createdAtRaw
        : createdAtRaw instanceof Date
          ? createdAtRaw.toISOString()
          : null;

    return {
      id: typeof idValue === 'number' ? idValue : Number(idValue ?? 0),
      name,
      email,
      createdAt,
    };
  }

  private buildSearchCondition(input: PartialStringRecord): ExpressionNode | undefined {
    let condition: ExpressionNode | undefined;
    for (const field of this.searchFields) {
      const value = input[field];
      if (value === undefined || value === null || value === '') continue;
      const column = this.table.columns[field];
      if (!column) continue;
      const next = eq(column, value as string | number | boolean);
      condition = condition ? and(condition, next) : next;
    }
    return condition;
  }

  async list(_ctx: RequestContext): Promise<Record<string, unknown>[]> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = await selectFromEntity(User)
        .select(this.selection)
        .orderBy(this.table.columns.id, 'ASC')
        .execute(session);
      return rows.map((row) => this.formatUser(row));
    });
  }

  async count(_ctx: RequestContext): Promise<{ count: number }> {
    await this.ready;
    return this.withSession(async (session) => {
      const results = (await selectFromEntity(User)
        .select({ count: count(this.table.columns.id) })
        .execute(session)) as Array<{ count?: number | string | null }>;
      const value = results[0]?.count;
      return { count: typeof value === 'number' ? value : Number(value ?? 0) };
    });
  }

  async search(ctx: RequestContext): Promise<Record<string, unknown>[]> {
    await this.ready;
    const input = ctx.input.query as PartialStringRecord;
    return this.withSession(async (session) => {
      let query = selectFromEntity(User)
        .select(this.selection)
        .orderBy(this.table.columns.id, 'ASC');
      const condition = this.buildSearchCondition(input);
      if (condition) {
        query = query.where(condition);
      }
      const executed = await query.execute(session);
      return executed.map((row) => this.formatUser(row));
    });
  }

  async get(ctx: RequestContext): Promise<Record<string, unknown>> {
    await this.ready;
    const id = (ctx.input.params as PartialStringRecord).id as number;
    return this.withSession(async (session) => {
      const user = await session.find(User, id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return this.formatUser(user);
    });
  }

  async create(ctx: RequestContext): Promise<Record<string, unknown>> {
    await this.ready;
    const body = ctx.input.body as UserCreateBody;
    return this.withSession(async (session) => {
      const user = new User();
      user.name = body.name;
      user.email = body.email ?? null;
      await session.persist(user);
      await session.commit();
      return this.formatUser(user);
    });
  }

  async update(ctx: RequestContext): Promise<Record<string, unknown>> {
    await this.ready;
    const body = ctx.input.body as UserUpdateBody;
    const id = (ctx.input.params as PartialStringRecord).id as number;
    return this.withSession(async (session) => {
      const user = await session.find(User, id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      if (body.name !== undefined) {
        user.name = body.name;
      }
      if (body.email !== undefined) {
        user.email = body.email;
      }
      await session.commit();
      return this.formatUser(user);
    });
  }

  async remove(ctx: RequestContext): Promise<void> {
    await this.ready;
    const id = (ctx.input.params as PartialStringRecord).id as number;
    return this.withSession(async (session) => {
      const user = await session.find(User, id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      await session.remove(user);
      await session.commit();
    });
  }
}
