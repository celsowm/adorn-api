import request from 'supertest';
import { describe, expect, it } from 'vitest';
import express from 'express';
import { registerControllers } from '../../src/index.js';
import { MetalOrmFlexibleUsersController } from './controllers/metal-orm-decorator-flexible.controller.js';

function buildFlexibleMetalOrmApp() {
  const app = express();
  app.use(express.json());

  const controller = new MetalOrmFlexibleUsersController();

  registerControllers(app, [MetalOrmFlexibleUsersController], {
    validateResponse: true,
    resolveController: () => controller,
  });

  return app;
}

describe('metal-orm decorator flexible e2e with sqlite memory db', () => {
  it('should perform CRUD operations using custom query handlers', async () => {
    const app = buildFlexibleMetalOrmApp();

    const postRes = await request(app)
      .post('/metal-orm-decorator-flexible-users')
      .send({ name: 'Charlie', email: 'charlie@example.com' })
      .expect(200);

    expect(postRes.body).toEqual({
      id: 3,
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: expect.any(String)
    });

    const getRes = await request(app)
      .get('/metal-orm-decorator-flexible-users/3')
      .expect(200);

    expect(getRes.body).toEqual({
      id: 3,
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: expect.any(String)
    });

    const listRes = await request(app)
      .get('/metal-orm-decorator-flexible-users')
      .expect(200);

    expect(listRes.body).toHaveLength(3);
    expect(listRes.body[0].name).toBe('Alice');
    expect(listRes.body[1].name).toBe('Bob');
    expect(listRes.body[2].name).toBe('Charlie');

    const putRes = await request(app)
      .put('/metal-orm-decorator-flexible-users/3')
      .send({ name: 'Charlotte', email: 'charlotte@example.com' })
      .expect(200);

    expect(putRes.body).toEqual({
      id: 3,
      name: 'Charlotte',
      email: 'charlotte@example.com',
      createdAt: expect.any(String)
    });

    const getUpdatedRes = await request(app)
      .get('/metal-orm-decorator-flexible-users/3')
      .expect(200);

    expect(getUpdatedRes.body.name).toBe('Charlotte');
    expect(getUpdatedRes.body.email).toBe('charlotte@example.com');

    const countRes = await request(app)
      .get('/metal-orm-decorator-flexible-users/count')
      .expect(200);

    expect(countRes.body).toEqual({ count: 3 });

    const searchRes = await request(app)
      .get('/metal-orm-decorator-flexible-users/search?name=Charlotte')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Charlotte');

    await request(app)
      .delete('/metal-orm-decorator-flexible-users/3')
      .expect(204);

    await request(app)
      .get('/metal-orm-decorator-flexible-users/3')
      .expect(500);

    const finalCountRes = await request(app)
      .get('/metal-orm-decorator-flexible-users/count')
      .expect(200);

    expect(finalCountRes.body).toEqual({ count: 2 });
  });

  it('should return 400 for invalid body on POST', async () => {
    const app = buildFlexibleMetalOrmApp();
    await request(app)
      .post('/metal-orm-decorator-flexible-users')
      .send({ name: '' })
      .expect(400);
  });
});
