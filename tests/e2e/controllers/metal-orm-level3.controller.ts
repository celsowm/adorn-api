import { z } from 'zod';
import { Controller, Get, Post, Put, Delete, named, p, EmptyQuery, EmptyResponse } from '../../../src/index.js';
import type { RequestContext } from '../../../src/index.js';
import { ensureDecoratorMetadata } from '../../../src/runtime/metadataPolyfill.js';
import {
  Entity,
  Column,
  PrimaryKey,
  col,
  selectFromEntity,
  entityRef,
  and,
  eq,
  Orm,
  type OrmSession,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from 'metal-orm';
import sqlite3 from 'sqlite3';

ensureDecoratorMetadata();

class SqlitePromiseClient implements SqliteClientLike {
  constructor(private readonly db: sqlite3.Database) {}

  all(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Array<Record<string, unknown>>);
      });
    });
  }

  run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async beginTransaction(): Promise<void> {
    await this.run('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    await this.run('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.run('ROLLBACK');
  }
}

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
    }
  }
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

const UserResponse = named('UserResponse', z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional()
}));
const UserListResponse = named('UserListResponse', z.array(UserResponse.schema));
const UserCountResponse = named('UserCountResponse', z.object({ count: z.number().int() }));

const CreateUserBody = named('CreateUserBody', z.object({
  name: z.string().min(1),
  email: z.string().email().optional()
}));

const UpdateUserBody = named('UpdateUserBody', z.object({
  name: z.string().min(1),
  email: z.string().email().optional()
}));

const UserSearchQuery = named('UserSearchQuery', z.object({
  name: z.string().optional(),
  email: z.string().optional()
}));

const UserParams = named('UserParams', z.object({ id: p.int() }));

@Controller('/metal-orm-decorator-users')
export class MetalOrmDecoratorUsersController {
  private readonly db: sqlite3.Database;
  private readonly orm: Orm;
  private readonly ready: Promise<void>;
  private readonly sqliteClient: SqlitePromiseClient;

  constructor() {
    this.db = new sqlite3.Database(':memory:');
    this.sqliteClient = new SqlitePromiseClient(this.db);
    const dialect = new SqliteDialect();
    this.orm = new Orm({
      dialect,
      executorFactory: {
        createExecutor: () => createSqliteExecutor(this.sqliteClient),
        createTransactionalExecutor: () => createSqliteExecutor(this.sqliteClient),
        dispose: async () => {}
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

  private async withSession<T>(fn: (session: OrmSession) => Promise<T>): Promise<T> {
    const session = this.orm.createSession();
    try {
      return await fn(session);
    } finally {
      await session.dispose();
    }
  }

  @Get('/', {
    query: EmptyQuery,
    response: UserListResponse,
  })
  async listUsers(_ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    await this.ready;
    return this.withSession(async (session) => {
      const u = entityRef(User);
      const users = await selectFromEntity(User)
        .select('id', 'name', 'email', 'createdAt')
        .orderBy(u.id, 'ASC')
        .execute(session);

      return users.map((user) => ({
        id: typeof user.id === 'number' ? user.id : Number(user.id),
        name: user.name,
        email: user.email ?? null,
        createdAt: user.createdAt ?? null,
      }));
    });
  }

  @Get('/count', {
    query: EmptyQuery,
    response: UserCountResponse,
  })
  async countUsers(_ctx: RequestContext): Promise<{ count: number }> {
    await this.ready;
    return this.withSession(async (session) => {
      const total = await selectFromEntity(User)
        .select('id')
        .count(session);
      return { count: total };
    });
  }

  @Get('/search', {
    query: UserSearchQuery,
    response: UserListResponse,
  })
  async searchUsers(ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    const { name, email } = ctx.input.query as { name?: string; email?: string };
    await this.ready;
    return this.withSession(async (session) => {
      const u = entityRef(User);

      let query = selectFromEntity(User)
        .select('id', 'name', 'email', 'createdAt');

      if (name) {
        query = query.where(eq(u.$.name, name));
      }

      if (email) {
        const condition = name ? and(eq(u.$.name, name), eq(u.email, email)) : eq(u.email, email);
        query = query.where(condition);
      }

      const users = await query.execute(session);
      return users.map((user) => ({
        id: typeof user.id === 'number' ? user.id : Number(user.id),
        name: user.name,
        email: user.email ?? null,
        createdAt: user.createdAt ?? null,
      }));
    });
  }

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async getUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { id } = ctx.input.params as { id: number };
    await this.ready;
    return this.withSession(async (session) => {
      const u = entityRef(User);
      const users = await selectFromEntity(User)
        .select('id', 'name', 'email', 'createdAt')
        .where(eq(u.id, id))
        .execute(session);

      const user = users[0];
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: typeof user.id === 'number' ? user.id : Number(user.id),
        name: user.name,
        email: user.email ?? null,
        createdAt: user.createdAt ?? null,
      };
    });
  }

  @Post('/', {
    query: EmptyQuery,
    body: CreateUserBody,
    response: UserResponse,
  })
  async createUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { name, email } = ctx.input.body as { name: string; email?: string };
    await this.ready;
    return this.withSession(async (session) => {
      const user = new User();
      user.name = name;
      if (email !== undefined) {
        user.email = email;
      }
      await session.persist(user);
      await session.commit();

      return {
        id: typeof user.id === 'number' ? user.id : Number(user.id),
        name: user.name,
        email: user.email ?? null,
        createdAt: user.createdAt ?? null,
      };
    });
  }

  @Put('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    body: UpdateUserBody,
    response: UserResponse,
  })
  async updateUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { id } = ctx.input.params as { id: number };
    const { name, email } = ctx.input.body as { name: string; email?: string };
    await this.ready;
    return this.withSession(async (session) => {
      const u = entityRef(User);
      const users = await selectFromEntity(User)
        .select('id', 'name', 'email', 'createdAt')
        .where(eq(u.id, id))
        .execute(session);

      const user = users[0];
      if (!user) {
        throw new Error('User not found');
      }

      user.name = name;
      if (email !== undefined) {
        user.email = email;
      }

      await session.commit();

      return {
        id: typeof user.id === 'number' ? user.id : Number(user.id),
        name: user.name,
        email: user.email ?? null,
        createdAt: user.createdAt ?? null,
      };
    });
  }

  @Delete('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async deleteUser(ctx: RequestContext): Promise<void> {
    const { id } = ctx.input.params as { id: number };
    await this.ready;
    await this.withSession(async (session) => {
      const u = entityRef(User);
      const users = await selectFromEntity(User)
        .select('id', 'name', 'email', 'createdAt')
        .where(eq(u.id, id))
        .execute(session);

      const user = users[0];
      if (!user) {
        throw new Error('User not found');
      }

      await session.remove(user);
      await session.commit();
    });
  }
}
