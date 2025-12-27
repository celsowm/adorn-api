import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './app.js';

describe('metal-orm restful + custom routes', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let close: Awaited<ReturnType<typeof createTestApp>>['close'];

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    close = setup.close;
  });

  afterAll(async () => {
    await close();
  });

  it('handles full CRUD for orders', async () => {
    const listRes = await request(app).get('/orders');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);

    const createRes = await request(app)
      .post('/orders')
      .send({ user_id: 1, total: 12.5, status: 'open' });
    expect(createRes.status).toBe(200);
    expect(createRes.body.status).toBe('open');

    const id = createRes.body.id;
    const getRes = await request(app).get(`/orders/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.total).toBe(12.5);

    const putRes = await request(app)
      .put(`/orders/${id}`)
      .send({ user_id: 1, total: 20.5, status: 'processing' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe('processing');

    const patchRes = await request(app)
      .patch(`/orders/${id}`)
      .send({ total: 33 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.total).toBe(33);

    const deleteRes = await request(app).delete(`/orders/${id}`);
    expect(deleteRes.status).toBe(204);

    const missingRes = await request(app).get(`/orders/${id}`);
    expect(missingRes.status).toBe(404);
  });

  it('supports non-crud routes', async () => {
    const cancelRes = await request(app).post('/orders/201/cancel');
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');

    const activateRes = await request(app).post('/users/1/activate');
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.active).toBeTruthy();

    const reportRes = await request(app).get('/reports/orders');
    expect(reportRes.status).toBe(200);
    expect(Array.isArray(reportRes.body)).toBe(true);
    expect(reportRes.body.length).toBeGreaterThan(0);
  });
});
