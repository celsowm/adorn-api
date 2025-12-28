import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Controller, Get } from '../../src/decorators/index.js';

@Controller('/health')
class HealthController {
  @Get('')
  status(): { status: string } {
    return { status: 'ok' };
  }
}

@Controller('/fail')
class FailController {
  @Get('')
  boom(): never {
    throw new Error('boom failure');
  }
}

describe('createAdornExpressApp options', () => {
  it('skips OpenAPI routes when docs are disabled', async () => {
    const app = createAdornExpressApp({
      controllers: [HealthController],
      openapi: { enabled: false, title: 'Docs Disabled', version: '0.0' },
    });

    const jsonRes = await request(app).get('/openapi.json');
    expect(jsonRes.status).toBe(404);
    expect(jsonRes.text).toMatch(/Cannot GET \/openapi\.json/);

    const docsRes = await request(app).get('/docs');
    expect(docsRes.status).toBe(404);
    expect(docsRes.text).toMatch(/Cannot GET \/docs/);
  });

  it('leaves Express default error handler when disabled', async () => {
    const app = createAdornExpressApp({
      controllers: [FailController],
      errorHandler: false,
    });

    const res = await request(app).get('/fail');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Error: boom failure');
  });
});
