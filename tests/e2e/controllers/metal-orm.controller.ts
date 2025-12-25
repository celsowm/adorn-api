import { z } from 'zod';
import { Controller, Get, Post, Put, Delete, named, p, EmptyQuery, EmptyResponse } from '../../../src/index.js';
import type { RequestContext } from '../../../src/index.js';
import {
  defineTable,
  col,
  selectFrom,
  eq,
  SqliteDialect,
  tableRef,
  insertInto,
  update,
  deleteFrom,
  count,
  and
} from 'metal-orm';
import sqlite3 from 'sqlite3';

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

@Controller('/metal-orm-users')
export class MetalOrmUsersController {
  private readonly db: sqlite3.Database;
  private readonly dialect: SqliteDialect;
  private readonly ready: Promise<void>;

  constructor() {
    this.db = new sqlite3.Database(':memory:');
    this.dialect = new SqliteDialect();
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

  private getRow<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row as T | undefined);
      });
    });
  }

  private allRows<T>(sql: string, params: unknown[] = []): Promise<Array<T>> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Array<T>);
      });
    });
  }

  @Get('/', {
    query: EmptyQuery,
    response: UserListResponse,
  })
  async listUsers(ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    await this.ready;
    const u = tableRef(users);

    const query = selectFrom(users)
      .select('id', 'name', 'email', 'createdAt')
      .orderBy(u.id, 'ASC');

    const compiled = query.compile(this.dialect);
    const rows = await this.allRows<{
      id: number;
      name: string;
      email?: string | null;
      createdAt?: string | null;
    }>(compiled.sql, compiled.params ?? []);

    return rows;
  }

  @Get('/count', {
    query: EmptyQuery,
    response: UserCountResponse,
  })
  async countUsers(ctx: RequestContext): Promise<{ count: number }> {
    await this.ready;
    const u = tableRef(users);

    const query = selectFrom(users)
      .select({ count: count(u.id) });

    const compiled = query.compile(this.dialect);
    const result = await this.getRow<{ count: number }>(compiled.sql, compiled.params ?? []);

    return { count: result?.count ?? 0 };
  }

  @Get('/search', {
    query: UserSearchQuery,
    response: UserListResponse,
  })
  async searchUsers(ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    const { name, email } = ctx.input.query as { name?: string; email?: string };
    await this.ready;
    const u = tableRef(users);

    let query = selectFrom(users)
      .select('id', 'name', 'email', 'createdAt');

    if (name) {
      query = query.where(eq(u.$.name, name));
    }

    if (email) {
      const condition = name ? and(eq(u.$.name, name), eq(u.email, email)) : eq(u.email, email);
      query = query.where(condition);
    }

    const compiled = query.compile(this.dialect);
    const rows = await this.allRows<{
      id: number;
      name: string;
      email?: string | null;
      createdAt?: string | null;
    }>(compiled.sql, compiled.params ?? []);

    return rows;
  }

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async getUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { id } = ctx.input.params as { id: number };
    await this.ready;
    const u = tableRef(users);

    const query = selectFrom(users)
      .select('id', 'name', 'email', 'createdAt')
      .where(eq(u.id, id));

    const compiled = query.compile(this.dialect);
    const row = await this.getRow<{
      id: number;
      name: string;
      email?: string | null;
      createdAt?: string | null;
    }>(compiled.sql, compiled.params ?? []);

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
    await this.ready;

    const createdAt = new Date().toISOString();
    const insertStmt = insertInto(users)
      .values({ name, email: email || null, createdAt })
      .returning(users.columns.id, users.columns.name, users.columns.email, users.columns.createdAt)
      .compile(this.dialect);

    const result = await this.getRow<{
      id: number;
      name: string;
      email: string | null;
      createdAt: string;
    }>(insertStmt.sql, insertStmt.params ?? []);

    if (!result) {
      throw new Error('Failed to create user');
    }

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
    await this.ready;
    const u = tableRef(users);

    // First check if user exists
    const existsQuery = selectFrom(users)
      .select({ count: count(u.id) })
      .where(eq(u.id, id))
      .compile(this.dialect);

    const existsResult = await this.getRow<{ count: number }>(
      existsQuery.sql,
      existsQuery.params ?? [],
    );
    if (!existsResult || existsResult.count === 0) {
      throw new Error('User not found');
    }

    const updateStmt = update(users)
      .set({ name, email: email || null })
      .where(eq(u.id, id))
      .returning(users.columns.id, users.columns.name, users.columns.email, users.columns.createdAt)
      .compile(this.dialect);

    const result = await this.getRow<{
      id: number;
      name: string;
      email: string | null;
      createdAt: string;
    }>(updateStmt.sql, updateStmt.params ?? []);

    if (!result) {
      throw new Error('Failed to update user');
    }

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
    await this.ready;
    const u = tableRef(users);

    // First check if user exists
    const existsQuery = selectFrom(users)
      .select({ count: count(u.id) })
      .where(eq(u.id, id))
      .compile(this.dialect);

    const existsResult = await this.getRow<{ count: number }>(
      existsQuery.sql,
      existsQuery.params ?? [],
    );
    if (!existsResult || existsResult.count === 0) {
      throw new Error('User not found');
    }

    const deleteStmt = deleteFrom(users)
      .where(eq(u.id, id))
      .compile(this.dialect);

    await this.runSql(deleteStmt.sql, deleteStmt.params ?? []);
  }
}
