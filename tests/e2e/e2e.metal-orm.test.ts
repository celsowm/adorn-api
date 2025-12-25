import request from 'supertest';
import { describe, it, expect } from 'vitest';
import express from 'express';
import { registerControllers } from '../../src/index.js';
import { MetalOrmUsersController } from './controllers/metal-orm.controller.js';

function buildMetalOrmApp() {
  const app = express();
  app.use(express.json());

  const controller = new MetalOrmUsersController();

  registerControllers(app, [MetalOrmUsersController], {
    validateResponse: true,
    resolveController: () => controller,
  });

  return app;
}

describe('metal-orm e2e with sqlite memory db', () => {
  it('should perform full CRUD operations using metal-orm with sqlite memory db', async () => {
    const app = buildMetalOrmApp();

    // 1. Create (INSERT) - Test creating a new user
    const postRes = await request(app)
      .post('/metal-orm-users')
      .send({ name: 'Charlie', email: 'charlie@example.com' })
      .expect(200);

    expect(postRes.body).toEqual({
      id: 3, // Alice=1, Bob=2, Charlie=3
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: expect.any(String)
    });

    // 2. Read (SELECT) - Test getting the created user
    const getRes = await request(app)
      .get('/metal-orm-users/3')
      .expect(200);

    expect(getRes.body).toEqual({
      id: 3,
      name: 'Charlie',
      email: 'charlie@example.com',
      createdAt: expect.any(String)
    });

    // 3. List all users - Test listing all users
    const listRes = await request(app)
      .get('/metal-orm-users')
      .expect(200);

    expect(listRes.body).toHaveLength(3);
    expect(listRes.body[0].name).toBe('Alice');
    expect(listRes.body[1].name).toBe('Bob');
    expect(listRes.body[2].name).toBe('Charlie');

    // 4. Update (UPDATE) - Test updating a user
    const putRes = await request(app)
      .put('/metal-orm-users/3')
      .send({ name: 'Charlotte', email: 'charlotte@example.com' })
      .expect(200);

    expect(putRes.body).toEqual({
      id: 3,
      name: 'Charlotte',
      email: 'charlotte@example.com',
      createdAt: expect.any(String)
    });

    // Verify update
    const getUpdatedRes = await request(app)
      .get('/metal-orm-users/3')
      .expect(200);

    expect(getUpdatedRes.body.name).toBe('Charlotte');
    expect(getUpdatedRes.body.email).toBe('charlotte@example.com');

    // 5. Count users - Test count endpoint
    const countRes = await request(app)
      .get('/metal-orm-users/count')
      .expect(200);

    expect(countRes.body).toEqual({ count: 3 });

    // 6. Search users - Test search endpoint
    const searchRes = await request(app)
      .get('/metal-orm-users/search?name=Charlotte')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Charlotte');

    // 7. Delete (DELETE) - Test deleting a user
    await request(app)
      .delete('/metal-orm-users/3')
      .expect(204);

    // Verify deletion
    await request(app)
      .get('/metal-orm-users/3')
      .expect(404); // NotFoundError now flows through the HTTP error handler

    // Verify count after deletion
    const finalCountRes = await request(app)
      .get('/metal-orm-users/count')
      .expect(200);

    expect(finalCountRes.body).toEqual({ count: 2 });
  });

  it('should return 400 for invalid body on POST', async () => {
    const app = buildMetalOrmApp();
    await request(app)
      .post('/metal-orm-users')
      .send({ name: '' }) // name.min(1)
      .expect(400);
  });

  it('should return 400 for invalid email format', async () => {
    const app = buildMetalOrmApp();
    await request(app)
      .post('/metal-orm-users')
      .send({ name: 'Test User', email: 'invalid-email' })
      .expect(400);
  });

  it('should handle optional email field', async () => {
    const app = buildMetalOrmApp();

    // Create user without email
    const postRes = await request(app)
      .post('/metal-orm-users')
      .send({ name: 'No Email User' })
      .expect(200);

    expect(postRes.body).toEqual({
      id: 3,
      name: 'No Email User',
      email: null,
      createdAt: expect.any(String)
    });

    // Verify the user was created without email
    const getRes = await request(app)
      .get('/metal-orm-users/3')
      .expect(200);

    expect(getRes.body.email).toBeNull();
  });

  it('should test search by email', async () => {
    const app = buildMetalOrmApp();

    // Search by email
    const searchRes = await request(app)
      .get('/metal-orm-users/search?email=alice@example.com')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Alice');
    expect(searchRes.body[0].email).toBe('alice@example.com');
  });

  it('should test search by name and email', async () => {
    const app = buildMetalOrmApp();

    // Search by both name and email
    const searchRes = await request(app)
      .get('/metal-orm-users/search?name=Alice&email=alice@example.com')
      .expect(200);

    expect(searchRes.body).toHaveLength(1);
    expect(searchRes.body[0].name).toBe('Alice');
    expect(searchRes.body[0].email).toBe('alice@example.com');
  });
});
