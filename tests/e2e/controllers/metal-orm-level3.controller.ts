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
  insertInto,
  update,
  deleteFrom,
  count,
  and,
  eq,
  SqliteDialect,
  getTableDefFromEntity
} from 'metal-orm';
import sqlite3 from 'sqlite3';

ensureDecoratorMetadata();

@Entity()
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

const Level3UserResponse = named('Level3UserResponse', z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional()
}));
const Level3UserListResponse = named('Level3UserListResponse', z.array(Level3UserResponse.schema));
const Level3UserCountResponse = named('Level3UserCountResponse', z.object({ count: z.number().int() }));

const Level3CreateUserBody = named('Level3CreateUserBody', z.object({
  name: z.string().min(1),
  email: z.string().email().optional()
}));

const Level3UpdateUserBody = named('Level3UpdateUserBody', z.object({
  name: z.string().min(1),
  email: z.string().email().optional()
}));

const Level3UserSearchQuery = named('Level3UserSearchQuery', z.object({
  name: z.string().optional(),
  email: z.string().optional()
}));

const Level3UserParams = named('Level3UserParams', z.object({ id: p.int() }));

const getUsersTable = () => {
  const table = getTableDefFromEntity(User);
  if (!table) {
    throw new Error('User entity metadata is not registered');
  }
  return table;
};

@Controller('/metal-orm-level3-users')
export class MetalOrmLevel3UsersController {
  private readonly db: sqlite3.Database;
  private readonly dialect: SqliteDialect;
  private readonly ready: Promise<void>;
  private readonly usersTable = getUsersTable();

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
        email TEXT UNIQUE,
        createdAt TEXT
      )
    `);

    const now = new Date().toISOString();
    const seedStmt = insertInto(this.usersTable)
      .values([
        { name: 'Alice', email: 'alice@example.com', createdAt: now },
        { name: 'Bob', email: 'bob@example.com', createdAt: now }
      ])
      .compile(this.dialect);

    await this.runSql(seedStmt.sql, seedStmt.params ?? []);
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
    response: Level3UserListResponse,
  })
  async listUsers(_ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    await this.ready;
    const u = entityRef(User);

    const query = selectFromEntity(User)
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
    response: Level3UserCountResponse,
  })
  async countUsers(_ctx: RequestContext): Promise<{ count: number }> {
    await this.ready;
    const u = entityRef(User);

    const query = selectFromEntity(User)
      .select({ count: count(u.id) });

    const compiled = query.compile(this.dialect);
    const result = await this.getRow<{ count: number }>(compiled.sql, compiled.params ?? []);

    return { count: result?.count ?? 0 };
  }

  @Get('/search', {
    query: Level3UserSearchQuery,
    response: Level3UserListResponse,
  })
  async searchUsers(ctx: RequestContext): Promise<Array<{ id: number; name: string; email?: string | null; createdAt?: string | null }>> {
    const { name, email } = ctx.input.query as { name?: string; email?: string };
    await this.ready;
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
    params: Level3UserParams,
    query: EmptyQuery,
    response: Level3UserResponse,
  })
  async getUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { id } = ctx.input.params as { id: number };
    await this.ready;
    const u = entityRef(User);

    const query = selectFromEntity(User)
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
    body: Level3CreateUserBody,
    response: Level3UserResponse,
  })
  async createUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { name, email } = ctx.input.body as { name: string; email?: string };
    await this.ready;

    const createdAt = new Date().toISOString();
    const insertStmt = insertInto(this.usersTable)
      .values({ name, email: email || null, createdAt })
      .returning(
        this.usersTable.columns.id,
        this.usersTable.columns.name,
        this.usersTable.columns.email,
        this.usersTable.columns.createdAt
      )
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
    params: Level3UserParams,
    query: EmptyQuery,
    body: Level3UpdateUserBody,
    response: Level3UserResponse,
  })
  async updateUser(ctx: RequestContext): Promise<{ id: number; name: string; email?: string | null; createdAt?: string | null }> {
    const { id } = ctx.input.params as { id: number };
    const { name, email } = ctx.input.body as { name: string; email?: string };
    await this.ready;
    const u = entityRef(User);

    const existsQuery = selectFromEntity(User)
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

    const updateStmt = update(this.usersTable)
      .set({ name, email: email || null })
      .where(eq(u.id, id))
      .returning(
        this.usersTable.columns.id,
        this.usersTable.columns.name,
        this.usersTable.columns.email,
        this.usersTable.columns.createdAt
      )
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
    params: Level3UserParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async deleteUser(ctx: RequestContext): Promise<void> {
    const { id } = ctx.input.params as { id: number };
    await this.ready;
    const u = entityRef(User);

    const existsQuery = selectFromEntity(User)
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

    const deleteStmt = deleteFrom(this.usersTable)
      .where(eq(u.id, id))
      .compile(this.dialect);

    await this.runSql(deleteStmt.sql, deleteStmt.params ?? []);
  }
}
