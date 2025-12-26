import request from 'supertest';
import { describe, it, expect } from 'vitest';
import express from 'express';
import { registerControllers } from '../../src/index.js';
import { MetalOrmEntityClientsController } from './controllers/metal-orm-entity.controller.js';

function buildMetalOrmEntityApp() {
  const app = express();
  app.use(express.json());

  const controller = new MetalOrmEntityClientsController();

  registerControllers(app, [MetalOrmEntityClientsController], {
    validateResponse: true,
    resolveController: () => controller,
  });

  return app;
}

describe('metal-orm entity controller e2e with sqlite memory db', () => {
  it('should perform full CRUD operations using entity-backed controller', async () => {
    const app = buildMetalOrmEntityApp();

    const postRes = await request(app)
      .post('/metal-orm-entity-clients')
      .send({ name: 'Charlie', email: 'charlie@example.com', serviceIds: [1, 3] })
      .expect(200);

    expect(postRes.body).toEqual({
      id: 3,
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: expect.any(String),
      services: [
        { id: 1, name: 'Consulting' },
        { id: 3, name: 'Delivery' },
      ],
    });

    const getRes = await request(app)
      .get('/metal-orm-entity-clients/3')
      .expect(200);

    expect(getRes.body).toEqual({
      id: 3,
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: expect.any(String),
      services: [
        { id: 1, name: 'Consulting' },
        { id: 3, name: 'Delivery' },
      ],
    });

    const listRes = await request(app)
      .get('/metal-orm-entity-clients')
      .expect(200);

    expect(listRes.body).toHaveLength(3);
    expect(listRes.body[0].services).toEqual([
      { id: 1, name: 'Consulting' },
      { id: 2, name: 'Support' },
    ]);
    expect(listRes.body[1].services).toEqual([
      { id: 2, name: 'Support' },
      { id: 3, name: 'Delivery' },
    ]);
    expect(listRes.body[2].services).toEqual([
      { id: 1, name: 'Consulting' },
      { id: 3, name: 'Delivery' },
    ]);

    const putRes = await request(app)
      .put('/metal-orm-entity-clients/3')
      .send({ name: 'Charlotte', email: 'charlotte@example.com', serviceIds: [2] })
      .expect(200);

    expect(putRes.body).toEqual({
      id: 3,
      name: 'Charlotte',
      email: 'charlotte@example.com',
      createdAt: expect.any(String),
      services: [{ id: 2, name: 'Support' }],
    });

    const getUpdatedRes = await request(app)
      .get('/metal-orm-entity-clients/3')
      .expect(200);

    expect(getUpdatedRes.body.name).toBe('Charlotte');
    expect(getUpdatedRes.body.email).toBe('charlotte@example.com');
    expect(getUpdatedRes.body.services).toEqual([{ id: 2, name: 'Support' }]);

    const countRes = await request(app)
      .get('/metal-orm-entity-clients/count')
      .expect(200);

    expect(countRes.body).toEqual({ count: 3 });

    const searchRes = await request(app)
      .get('/metal-orm-entity-clients/search?name=Charlotte')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Charlotte');
    expect(searchRes.body[0].services).toEqual([{ id: 2, name: 'Support' }]);

    await request(app)
      .delete('/metal-orm-entity-clients/3')
      .expect(204);

    await request(app)
      .get('/metal-orm-entity-clients/3')
      .expect(404);

    const finalCountRes = await request(app)
      .get('/metal-orm-entity-clients/count')
      .expect(200);

    expect(finalCountRes.body).toEqual({ count: 2 });
  });

  it('should return 400 for invalid body on POST', async () => {
    const app = buildMetalOrmEntityApp();
    await request(app)
      .post('/metal-orm-entity-clients')
      .send({ name: '' })
      .expect(400);
  });

  it('should handle optional email field', async () => {
    const app = buildMetalOrmEntityApp();

    const postRes = await request(app)
      .post('/metal-orm-entity-clients')
      .send({ name: 'No Email Client' })
      .expect(200);

    expect(postRes.body).toEqual({
      id: 3,
      name: 'No Email Client',
      email: null,
      createdAt: expect.any(String),
      services: [],
    });

    const getRes = await request(app)
      .get('/metal-orm-entity-clients/3')
      .expect(200);

    expect(getRes.body.email).toBeNull();
    expect(getRes.body.services).toEqual([]);
  });

  it('should test search by email', async () => {
    const app = buildMetalOrmEntityApp();

    const searchRes = await request(app)
      .get('/metal-orm-entity-clients/search?email=alice@example.com')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Alice');
    expect(searchRes.body[0].email).toBe('alice@example.com');
    expect(searchRes.body[0].services).toEqual([
      { id: 1, name: 'Consulting' },
      { id: 2, name: 'Support' },
    ]);
  });

  it('should test search by name and email', async () => {
    const app = buildMetalOrmEntityApp();

    const searchRes = await request(app)
      .get('/metal-orm-entity-clients/search?name=Alice&email=alice@example.com')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Alice');
    expect(searchRes.body[0].email).toBe('alice@example.com');
    expect(searchRes.body[0].services).toEqual([
      { id: 1, name: 'Consulting' },
      { id: 2, name: 'Support' },
    ]);
  });

  it('should return insights for clients and services', async () => {
    const app = buildMetalOrmEntityApp();

    const insightsRes = await request(app)
      .get('/metal-orm-entity-clients/insights')
      .expect(200);

    expect(insightsRes.body).toEqual({
      totalClients: 2,
      totalServiceLinks: 4,
      averageServicesPerClient: 2,
      topClients: [
        { id: 1, name: 'Alice', serviceCount: 2 },
        { id: 2, name: 'Bob', serviceCount: 2 },
      ],
    });
  });
});
