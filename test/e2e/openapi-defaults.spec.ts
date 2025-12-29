import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from 'adorn-api/express';
import { Bindings, Controller, Get, Post, Returns } from 'adorn-api';
import { v } from 'adorn-api';

const returnSchema = v.named(
  'ReturnItem',
  v.object({
    id: v.number().int(),
    name: v.string(),
  }).strict(),
);

@Controller('/defaults')
class DefaultsController {
  @Post('')
  create(): { ok: boolean } {
    return { ok: true };
  }

  @Get('/{id}')
  @Bindings({ path: { id: 'int' } })
  find(): { id: number } {
    return { id: 1 };
  }

  @Get('/returns')
  @Returns(returnSchema)
  returnsItem(): { id: number; name: string } {
    return { id: 1, name: 'Returned' };
  }
}

describe('OpenAPI defaults', () => {
  const app = createAdornExpressApp({
    controllers: [DefaultsController],
    openapi: {
      title: 'Defaults API',
      version: '0.1',
      jsonPath: '/docs/api-docs.json',
      docsPath: '/docs/swagger',
      includeDefaultErrors: true,
      swaggerUi: false,
    },
  });

  const getDoc = async () => {
    const res = await request(app).get('/docs/api-docs.json');
    expect(res.status).toBe(200);
    return res.body;
  };

  it('uses the runtime success status when no responses are declared', async () => {
    const doc = await getDoc();
    const responses = doc.paths['/defaults'].post.responses;
    expect(responses).toHaveProperty('201');
    expect(responses['201'].description).toBe('Created');
  });

  it('documents default problem/validation errors when enabled', async () => {
    const doc = await getDoc();
    const responses = doc.paths['/defaults'].post.responses;
    expect(responses['400']).toBeDefined();
    expect(responses['500']).toBeDefined();

    const validationSchema = responses['400'].content?.['application/problem+json']?.schema;
    const problemSchema = responses['500'].content?.['application/problem+json']?.schema;
    expect(validationSchema).toEqual({ $ref: '#/components/schemas/ValidationProblemDetails' });
    expect(problemSchema).toEqual({ $ref: '#/components/schemas/ProblemDetails' });

    expect(doc.components?.schemas?.ValidationProblemDetails).toBeDefined();
    expect(doc.components?.schemas?.ProblemDetails).toBeDefined();
  });

  it('derives path parameter types from bindings', async () => {
    const doc = await getDoc();
    const parameters = doc.paths['/defaults/{id}'].get.parameters ?? [];
    const idParam = parameters.find((param: { name: string }) => param.name === 'id');
    expect(idParam?.schema).toEqual({ type: 'integer', format: 'int32' });
  });

  it('applies @Returns schemas to operation responses', async () => {
    const doc = await getDoc();
    const responses = doc.paths['/defaults/returns'].get.responses;
    expect(responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ReturnItem',
    });
    expect(doc.components?.schemas?.ReturnItem).toBeDefined();
  });
});
