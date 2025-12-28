import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Controller, Get } from '../../src/decorators/index.js';

@Controller('/users')
class UsersController {
  @Get('')
  listUsers(query: { active?: boolean; ids?: number[] }) {
    return { filters: query };
  }
}

describe('GET /users', () => {
  it('coerces query params and arrays', async () => {
    const app = createAdornExpressApp({ controllers: [UsersController] });

    const res = await request(app)
      .get('/users')
      .query({ active: 'true', ids: ['1', '2', '3'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ filters: { active: true, ids: [1, 2, 3] } });
  });
});
