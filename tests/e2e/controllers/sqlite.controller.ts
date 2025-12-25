import { z } from 'zod';
import { Controller, Get, Post, Put, Delete, named, p, EmptyQuery, EmptyResponse } from '../../../src/index.js';
import type { RequestContext } from '../../../src/index.js';
import Database from 'better-sqlite3';

const UserResponse = named('UserResponse', z.object({ id: z.number().int(), name: z.string() }));
const CreateUserBody = named('CreateUserBody', z.object({ name: z.string().min(1) }));
const UpdateUserBody = named('UpdateUserBody', z.object({ name: z.string().min(1) }));
const UserParams = named('UserParams', z.object({ id: p.int() }));

@Controller('/sqlite-users')
export class SqliteUsersController {
  private db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
    this.init();
  }

  private init() {
    this.db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  }

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async getUser(ctx: RequestContext): Promise<{ id: number; name: string }> {
    const { id } = ctx.input.params as { id: number };
    const user = this.db.prepare('SELECT id, name FROM users WHERE id = ?').get(id) as { id: number; name: string } | undefined;

    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Post('/', {
    query: EmptyQuery,
    body: CreateUserBody,
    response: UserResponse,
  })
  async createUser(ctx: RequestContext): Promise<{ id: number; name: string }> {
    const { name } = ctx.input.body as { name: string };
    const info = this.db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
    return { id: info.lastInsertRowid as number, name };
  }

  @Put('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    body: UpdateUserBody,
    response: UserResponse,
  })
  async updateUser(ctx: RequestContext): Promise<{ id: number; name: string }> {
    const { id } = ctx.input.params as { id: number };
    const { name } = ctx.input.body as { name: string };
    
    const info = this.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
    
    if (info.changes === 0) {
      throw new Error('User not found');
    }
    
    return { id, name };
  }

  @Delete('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async deleteUser(ctx: RequestContext): Promise<void> {
    const { id } = ctx.input.params as { id: number };
    const info = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    if (info.changes === 0) {
      throw new Error('User not found');
    }
  }
}
