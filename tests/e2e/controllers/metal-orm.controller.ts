import { z } from 'zod';
import { Controller, Get, Post, Put, Delete, named, p, EmptyQuery, EmptyResponse } from '../../../src/index.js';
import type { RequestContext } from '../../../src/index.js';
import {
  defineTable,
  col,
  selectFrom,
  eq,
  SqliteDialect,
  Orm,
  OrmSession,
  createSqliteExecutor,
  tableRef,
  insertInto,
  update,
  deleteFrom,
  count,
  and
} from 'metal-orm';
import Database from 'better-sqlite3';

// Define the users table using metal-orm
const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(255)),
  email: col.varchar(255),
  createdAt: col.timestamp(),
});

// Add constraints
users.columns.email.unique = true;

const UserResponse = named('UserResponse', z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional()
}));

const CreateUserBody = named('CreateUserBody', z.object({
  name: z.string().min(1),
  email: z.string().email().optional()
}));

const UpdateUserBody = named('UpdateUserBody', z.object({
  name: z.string().min(1),
  email: z.string().email().optional()
}));

const UserParams = named('UserParams', z.object({ id: p.int() }));

@Controller('/metal-orm-users')
export class MetalOrmUsersController {
  private db: Database.Database;
  private orm: Orm;
  private dialect: SqliteDialect;

  constructor() {
    this.db = new Database(':memory:');
    this.dialect = new SqliteDialect();
    this.orm = new Orm({
      dialect: this.dialect,
      executorFactory: {
        createExecutor: () => createSqliteExecutor(this.db),
        createTransactionalExecutor: () => createSqliteExecutor(this.db),
        dispose: async () => {},
      },
    });
    this.init();
  }

  private init() {
    // Create the table using raw SQL for simplicity
    this.db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        createdAt TEXT,
        UNIQUE(email)
      )
    `);

    // Insert some initial data
    const stmt = this.db.prepare(`
      INSERT INTO users (name, email, createdAt) VALUES
        ('Alice', 'alice@example.com', ?),
        ('Bob', 'bob@example.com', ?)
    `);
    const now = new Date().toISOString();
    stmt.run(now, now);
  }

  @Get('/', {
    query: EmptyQuery,
    response: z.array(UserResponse),
  })
  async listUsers(ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });
    const u = tableRef(users);

    const query = selectFrom(users)
      .select('id', 'name', 'email', 'createdAt')
      .orderBy(u.id, 'ASC');

    const { sql, params } = query.compile(this.dialect);
    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number;
      name: string;
      email?: string | null;
      createdAt?: string | null;
    }>;

    return rows;
  }

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async getUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { id } = ctx.input.params as { id: number };
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });
    const u = tableRef(users);

    const query = selectFrom(users)
      .select('id', 'name', 'email', 'createdAt')
      .where(eq(u.id, id));

    const { sql, params } = query.compile(this.dialect);
    const row = this.db.prepare(sql).get(...params) as {
      id: number;
      name: string;
      email?: string | null;
      createdAt?: string | null;
    } | undefined;

    if (!row) {
      throw new Error('User not found');
    }

    return row;
  }

  @Post('/', {
    query: EmptyQuery,
    body: CreateUserBody,
    response: UserResponse,
  })
  async createUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { name, email } = ctx.input.body as { name: string; email?: string };
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });

    const createdAt = new Date().toISOString();
    const insertStmt = insertInto(users)
      .values({ name, email: email || null, createdAt })
      .returning('id', 'name', 'email', 'createdAt')
      .compile(this.dialect);

    const result = this.db.prepare(insertStmt.sql).get(...insertStmt.params) as {
      id: number;
      name: string;
      email: string | null;
      createdAt: string;
    };

    return {
      id: result.id,
      name: result.name,
      email: result.email,
      createdAt: result.createdAt
    };
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
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });
    const u = tableRef(users);

    // First check if user exists
    const existsQuery = selectFrom(users)
      .select(count(u.id))
      .where(eq(u.id, id))
      .compile(this.dialect);

    const existsResult = this.db.prepare(existsQuery.sql).get(...existsQuery.params) as { count: number };
    if (existsResult.count === 0) {
      throw new Error('User not found');
    }

    const updateStmt = update(users)
      .set({ name, email: email || null })
      .where(eq(u.id, id))
      .returning('id', 'name', 'email', 'createdAt')
      .compile(this.dialect);

    const result = this.db.prepare(updateStmt.sql).get(...updateStmt.params) as {
      id: number;
      name: string;
      email: string | null;
      createdAt: string;
    };

    return {
      id: result.id,
      name: result.name,
      email: result.email,
      createdAt: result.createdAt
    };
  }

  @Delete('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async deleteUser(ctx: RequestContext): Promise<void> {
    const { id } = ctx.input.params as { id: number };
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });
    const u = tableRef(users);

    // First check if user exists
    const existsQuery = selectFrom(users)
      .select(count(u.id))
      .where(eq(u.id, id))
      .compile(this.dialect);

    const existsResult = this.db.prepare(existsQuery.sql).get(...existsQuery.params) as { count: number };
    if (existsResult.count === 0) {
      throw new Error('User not found');
    }

    const deleteStmt = deleteFrom(users)
      .where(eq(u.id, id))
      .compile(this.dialect);

    this.db.prepare(deleteStmt.sql).run(...deleteStmt.params);
  }

  @Get('/count', {
    query: EmptyQuery,
    response: z.object({ count: z.number().int() }),
  })
  async countUsers(ctx: RequestContext): Promise<{ count: number }> {
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });
    const u = tableRef(users);

    const query = selectFrom(users)
      .select(count(u.id));

    const { sql, params } = query.compile(this.dialect);
    const result = this.db.prepare(sql).get(...params) as { count: number };

    return result;
  }

  @Get('/search', {
    query: z.object({
      name: z.string().optional(),
      email: z.string().optional()
    }),
    response: z.array(UserResponse),
  })
  async searchUsers(ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    const { name, email } = ctx.input.query as { name?: string; email?: string };
    const session = new OrmSession({ orm: this.orm, executor: createSqliteExecutor(this.db) });
    const u = tableRef(users);

    let query = selectFrom(users)
      .select('id', 'name', 'email', 'createdAt');

    if (name) {
      query = query.where(eq(u.name, name));
    }

    if (email) {
      const condition = name ? and(eq(u.name, name), eq(u.email, email)) : eq(u.email, email);
      query = query.where(condition);
    }

    const { sql, params } = query.compile(this.dialect);
    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number;
      name: string;
      email?: string | null;
      createdAt?: string | null;
    }>;

    return rows;
  }
}
