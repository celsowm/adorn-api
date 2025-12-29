import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from 'adorn-api/express';
import { Controller, Get, Post } from 'adorn-api';
import type { Reply } from 'adorn-api';
import { reply, noContent } from 'adorn-api';

describe('Minimal transformer test', () => {
  it('transformer generates validate.params and bindings.args', async () => {
    @Controller('/test')
    class TestController {
      @Get('/users/{id}')
      getUser(id: number): { id: number } {
        return { id };
      }
    }

    const app = createAdornExpressApp({ controllers: [TestController] });
    const res = await request(app).get('/test/users/123');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 123 });
  });

  it('transformer generates validate.query for query objects', async () => {
    @Controller('/test')
    class TestController {
      @Get('/search')
      search(query: { q: string; limit: number }): { q: string; limit: number } {
        return { q: query.q, limit: query.limit };
      }
    }

    const app = createAdornExpressApp({ controllers: [TestController] });
    const res = await request(app)
      .get('/test/search')
      .query({ q: 'test', limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ q: 'test', limit: 10 });
  });

  it('transformer generates validate.body for POST', async () => {
    @Controller('/test')
    class TestController {
      @Post('/items')
      createItem(body: { name: string; value: number }): { name: string; value: number } {
        return { name: body.name, value: body.value };
      }
    }

    const app = createAdornExpressApp({ controllers: [TestController] });
    const res = await request(app)
      .post('/test/items')
      .send({ name: 'item1', value: 42 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'item1', value: 42 });
  });

  it('transformer supports Reply<T, status> type', async () => {
    @Controller('/test')
    class TestController {
      @Get('/items/{id}')
      getItem(id: number): Reply<{ id: number }, 200> | Reply<undefined, 404> {
        if (id === 999) {
          return noContent(404);
        }
        return reply(200, { id });
      }
    }

    const app = createAdornExpressApp({ controllers: [TestController] });
    const res1 = await request(app).get('/test/items/100');
    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({ id: 100 });

    const res2 = await request(app).get('/test/items/999');
    expect(res2.status).toBe(404);
  });

  it('path param type coercion works', async () => {
    @Controller('/test')
    class TestController {
      @Get('/items/{uuid}')
      getItem(uuid: string): { uuid: string } {
        return { uuid };
      }
    }

    const app = createAdornExpressApp({ controllers: [TestController] });
    const res = await request(app).get('/test/items/123e45678-e89b-12d3-a456-426614174000');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uuid: '123e45678-e89b-12d3-a456-426614174000' });
  });
});
