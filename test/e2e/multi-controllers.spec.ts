import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from 'adorn-api/express';
import { Bindings, Controller, Get } from 'adorn-api';

@Controller('/users')
class UsersController {
  @Bindings({ path: { id: 'int' } })
  @Get('/{id}')
  getUser(id: number): { id: number; name: string } {
    return { id, name: `User ${id}` };
  }
}

@Controller('/products')
class ProductsController {
  @Bindings({ path: { id: 'int' } })
  @Get('/{id}')
  getProduct(id: number): { id: number; name: string; price: number } {
    return { id, name: `Product ${id}`, price: id * 10 };
  }
}

describe('Multiple Controllers', () => {
  const app = createAdornExpressApp({ controllers: [UsersController, ProductsController] });

  describe('GET /users/{id}', () => {
    it('returns the user with a coerced id', async () => {
      const res = await request(app).get('/users/42');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 42, name: 'User 42' });
    });
  });

  describe('GET /products/{id}', () => {
    it('returns the product with a coerced id', async () => {
      const res = await request(app).get('/products/5');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 5, name: 'Product 5', price: 50 });
    });
  });
});
