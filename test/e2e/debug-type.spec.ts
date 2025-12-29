import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from 'adorn-api/express';
import { Controller, Get } from 'adorn-api';

describe('Debug path param type issue', () => {
  it('simple path param with number type', async () => {
    @Controller('/test')
    class TestController {
      @Get('/items/{id}')
      getItem(id: number): { id: number; receivedType: string } {
        return { id, receivedType: typeof id };
      }
    }

    const app = createAdornExpressApp({ controllers: [TestController] });
    const res = await request(app).get('/test/items/100');

    console.log('Response:', res.body);
    console.log('id type:', typeof res.body.id);

    expect(res.status).toBe(200);
    expect(res.body.receivedType).toBe('number');
  });
});
