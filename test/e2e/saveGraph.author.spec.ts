import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Controller, Post } from '../../src/decorators/index.js';
import { reply } from '../../src/core/reply/reply.js';
import type { Reply } from '../../src/contracts/reply.js';
import { v } from '../../src/validation/native/index.js';

type AuthorInput = {
  name: string;
  books: Array<{ title: string }>;
};

type AuthorCreated = { id: number } & AuthorInput;

@Controller('/authors')
class AuthorsController {
  @Post('', {
    validate: {
      body: v.object({
        name: v.string().min(1),
        books: v.array(
          v.object({
            title: v.string().min(1),
          }),
        ).min(1),
      }),
    },
  })
  saveAuthor(body: AuthorInput): Reply<AuthorCreated, 201> {
    const created = { id: 1, ...body };
    return reply(201, created, { headers: { Location: '/authors/1' } });
  }
}

describe('POST /authors', () => {
  it('creates an author graph and returns a location', async () => {
    const app = createAdornExpressApp({ controllers: [AuthorsController] });

    const res = await request(app)
      .post('/authors')
      .send({ name: 'Ada', books: [{ title: 'Sketches' }] });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/authors/1');
    expect(res.body).toEqual({ id: 1, name: 'Ada', books: [{ title: 'Sketches' }] });
  });
});
