import request from 'supertest';
import { describe, it, expect } from 'vitest';
import express from 'express';
import { registerControllers } from '../../src/index.js';
import { SqliteUsersController } from './controllers/sqlite.controller.js';

function buildSqliteApp() {
  const app = express();
  app.use(express.json());

  const controller = new SqliteUsersController();

  registerControllers(app, [SqliteUsersController], {
    validateResponse: true,
    resolveController: () => controller,
  });

  return app;
}

describe('sqlite e2e', () => {
  it('should create and retrieve a user from sqlite memory db', async () => {
    const app = buildSqliteApp();

    // 1. Create a user
    const postRes = await request(app)
      .post('/sqlite-users')
      .send({ name: 'John Doe' })
      .expect(200);

    expect(postRes.body).toEqual({ id: 1, name: 'John Doe' });

    // 2. Retrieve the user
    const getRes = await request(app)
      .get('/sqlite-users/1')
      .expect(200);

    expect(getRes.body).toEqual({ id: 1, name: 'John Doe' });
  });

  it('should return 400 for invalid body on POST', async () => {
    const app = buildSqliteApp();
    await request(app)
      .post('/sqlite-users')
      .send({ name: '' }) // name.min(1)
      .expect(400);
  });
});
