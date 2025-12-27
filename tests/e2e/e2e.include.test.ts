import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { generateOpenApi } from '../../src/index.js';
import { createTestApp } from './app.js';
import { MetalOrmEntityController } from './controllers/metal-orm-entity.controller.js';

describe('metal-orm include integration', () => {
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

  it('includes allowed relations', async () => {
    const res = await request(app).get('/users?include=posts');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].posts.length).toBe(2);
  });

  it('rejects include depth beyond policy', async () => {
    const res = await request(app).get('/users?include=posts.user');
    expect(res.status).toBe(400);
  });

  it('exposes list response schemas in OpenAPI', () => {
    const openapi = generateOpenApi([MetalOrmEntityController]);
    expect(openapi.components.schemas.UserListResponse).toBeDefined();
  });
});
