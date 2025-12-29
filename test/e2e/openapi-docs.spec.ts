import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from 'adorn-api/express';
import {
  Controller,
  Get,
  OperationId,
  Responses,
  Security,
  SecurityScheme,
  Tags,
  Deprecated,
} from 'adorn-api';
import { v } from 'adorn-api';

const widgetSchema = v.named(
  'WidgetItem',
  v.object({
    id: v.number().int(),
    name: v.string(),
  }).strict(),
);

const widgetListSchema = v.named('WidgetList', v.array(widgetSchema));

@Controller('/items')
@SecurityScheme('apiKeyAuth', { type: 'apiKey', name: 'X-Api-Key', in: 'header' })
@Tags('Widgets')
class WidgetsController {
  @Get('')
  @OperationId('widgets.list')
  @Tags('Inventory')
  @Deprecated()
  @Security('apiKeyAuth')
  @Responses({
    200: {
      description: 'List widgets',
      content: {
        'application/json': {
          schema: widgetListSchema,
        },
      },
    },
  })
  list(): Array<{ id: number; name: string }> {
    return [
      { id: 1, name: 'Widget Alpha' },
      { id: 2, name: 'Widget Beta' },
    ];
  }
}

describe('OpenAPI docs middleware', () => {
  const app = createAdornExpressApp({
    controllers: [WidgetsController],
    openapi: {
      title: 'Docs API',
      version: '0.1',
      jsonPath: '/docs/api-docs.json',
      docsPath: '/docs/swagger',
      swaggerUi: true,
    },
  });

  it('exposes a generated OpenAPI document that reflects decorator metadata', async () => {
    const res = await request(app).get('/docs/api-docs.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);

    const doc = res.body;
    expect(doc.info).toEqual({ title: 'Docs API', version: '0.1' });

    const route = doc.paths['/items'].get;
    expect(route.operationId).toBe('widgets.list');
    expect(route.tags).toEqual(['Widgets', 'Inventory']);
    expect(route.deprecated).toBe(true);
    expect(route.responses['200'].description).toBe('List widgets');
    expect(route.security).toEqual([{ apiKeyAuth: [] }]);

    const schemaRef = route.responses['200'].content['application/json'].schema;
    expect(schemaRef).toEqual({ $ref: '#/components/schemas/WidgetList' });

    expect(doc.components?.securitySchemes?.apiKeyAuth).toEqual({
      type: 'apiKey',
      name: 'X-Api-Key',
      in: 'header',
    });
    expect(doc.components?.schemas?.WidgetList).toBeDefined();
  });

  it('serves the Swagger UI html on the configured docs path', async () => {
    const res = await request(app).get('/docs/swagger');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Docs API');
    expect(res.text).toContain('API Docs');
    expect(res.text).toContain('<div id="swagger-ui"></div>');
    expect(res.text).toContain('SwaggerUIBundle');
    expect(res.text).toContain('/docs/api-docs.json');
  });
});
