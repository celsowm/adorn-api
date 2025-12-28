import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Controller, Get } from '../../src/decorators/index.js';
import { HttpError } from '../../src/core/errors/http-error.js';

@Controller('/errors')
class ErrorsController {
  @Get('/boom')
  boom(): never {
    throw new Error('boom');
  }

  @Get('/teapot')
  teapot(): never {
    throw new HttpError(418, "I'm a teapot");
  }
}

describe('Adorn Express error handler', () => {
  it('returns Problem Details for unhandled exceptions', async () => {
    const app = createAdornExpressApp({ controllers: [ErrorsController] });

    const res = await request(app).get('/errors/boom');

    expect(res.status).toBe(500);
    expect(res.body.title).toBe('Internal Server Error');
    expect(res.body.status).toBe(500);
    expect(res.body.instance).toBe('/errors/boom');
  });

  it('allows a custom onError hook to override status, headers, and body', async () => {
    const app = createAdornExpressApp({
      controllers: [ErrorsController],
      errorHandler: {
        onError: (_err, ctx) => ({
          status: 418,
          headers: { 'x-handled': 'true' },
          body: { handled: true, title: ctx.defaultProblem.title },
        }),
      },
    });

    const res = await request(app).get('/errors/teapot');

    expect(res.status).toBe(418);
    expect(res.headers['x-handled']).toBe('true');
    expect(res.body).toEqual({ handled: true, title: "I'm a teapot" });
  });
});
