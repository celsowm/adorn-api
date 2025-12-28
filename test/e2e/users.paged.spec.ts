import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Controller, Get } from '../../src/decorators/index.js';
import { v } from '../../src/validation/native/index.js';

@Controller('/users')
class UsersController {
  @Get('/paged', {
    validate: {
      query: v.object({
        page: v.number().int().min(1),
        size: v.number().int().min(1),
      }),
    },
  })
  listPaged(query: { page: number; size: number }) {
    const offset = (query.page - 1) * query.size;
    return { page: query.page, size: query.size, offset };
  }
}

describe('GET /users/paged', () => {
  it('returns paging metadata', async () => {
    const app = createAdornExpressApp({ controllers: [UsersController] });

    const res = await request(app).get('/users/paged').query({ page: '2', size: '5' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ page: 2, size: 5, offset: 5 });
  });

  it('rejects invalid query params', async () => {
    const app = createAdornExpressApp({ controllers: [UsersController] });

    const res = await request(app).get('/users/paged').query({ page: '0', size: '5' });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
    expect(res.body.issues).toEqual([
      expect.objectContaining({ path: ['query', 'page'], code: 'too_small' }),
    ]);
  });
});
