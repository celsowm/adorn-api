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
  it('should perform full CRUD on sqlite memory db', async () => {
    const app = buildSqliteApp();

    // 1. Create (INSERT)
    const postRes = await request(app)
      .post('/sqlite-users')
      .send({ name: 'John Doe' })
      .expect(200);

    expect(postRes.body).toEqual({ id: 1, name: 'John Doe' });

    // 2. Read (SELECT)
    const getRes = await request(app)
      .get('/sqlite-users/1')
      .expect(200);

    expect(getRes.body).toEqual({ id: 1, name: 'John Doe' });

    // 3. Update (UPDATE)
    const putRes = await request(app)
      .put('/sqlite-users/1')
      .send({ name: 'Jane Doe' })
      .expect(200);

    expect(putRes.body).toEqual({ id: 1, name: 'Jane Doe' });

    // Verify update
    const getUpdatedRes = await request(app)
      .get('/sqlite-users/1')
      .expect(200);

    expect(getUpdatedRes.body.name).toBe('Jane Doe');

    // 4. Delete (DELETE)
    await request(app)
      .delete('/sqlite-users/1')
      .expect(204);

    // Verify deletion
    await request(app)
      .get('/sqlite-users/1')
      .expect(500); // Controller throws 'User not found' which results in 500 by default if not handled
  });

  it('should return 400 for invalid body on POST', async () => {
    const app = buildSqliteApp();
    await request(app)
      .post('/sqlite-users')
      .send({ name: '' }) // name.min(1)
      .expect(400);
  });
});
