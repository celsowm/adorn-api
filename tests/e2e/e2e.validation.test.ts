import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './app.js';

describe('validation e2e', () => {
  it('invalid params returns 400 ValidationError envelope', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/users/abc').expect(400);

    expect(res.body.error).toBe('ValidationError');
    expect(res.body.status).toBe(400);
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues[0].source).toBe('params');
  });

  it('invalid body returns 400', async () => {
    const app = buildTestApp();
    const res = await request(app).post('/users').send({}).expect(400);
    expect(res.body.error).toBe('ValidationError');
    expect(res.body.issues[0].source).toBe('body');
  });
});
