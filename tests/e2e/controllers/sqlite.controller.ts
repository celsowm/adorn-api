import { z } from 'zod';
import { Controller, Get, Post, named, p, EmptyQuery } from '../../../src/index.js';
import type { RequestContext } from '../../../src/index.js';

const UserResponse = named('UserResponse', z.object({ id: z.number().int(), name: z.string() }));
const CreateUserBody = named('CreateUserBody', z.object({ name: z.string().min(1) }));
const UserParams = named('UserParams', z.object({ id: p.int() }));

@Controller('/sqlite-users')
export class SqliteUsersController {
  private users: { id: number; name: string }[] = [];
  private nextId = 1;

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async getUser(ctx: RequestContext): Promise<{ id: number; name: string }> {
    const { id } = ctx.input.params as { id: number };
    const user = this.users.find((u) => u.id === id);

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
    const user = { id: this.nextId++, name };
    this.users.push(user);
    return user;
  }
}
