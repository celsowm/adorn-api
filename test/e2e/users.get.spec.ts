import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Bindings, Controller, Get } from '../../src/decorators/index.js';

@Controller('/users')
class UsersController {
  @Bindings({ path: { id: 'int' } })
  @Get('/{id}')
  getUser(id: number) {
    return { id, name: `User ${id}` };
  }
}

describe('GET /users/{id}', () => {
  it('returns the user with a coerced id', async () => {
    const app = createAdornExpressApp({ controllers: [UsersController] });

    const res = await request(app).get('/users/42');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, name: 'User 42' });
  });
});
