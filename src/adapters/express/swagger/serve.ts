import type { Router, Request, Response } from 'express';
import express from 'express';

import type { Registry } from '../../../core/registry/types';
import { buildOpenApi, type OpenApiBuildOptions } from '../../../core/openapi/buildOpenApi';

export type ServeOpenApiOptions = {
  jsonPath?: string;
  docsPath?: string;
  swaggerUi?: boolean;

  getRegistry?: () => Registry;
  swaggerUiConfig?: Record<string, unknown>;
};

export function serveOpenApi(
  registry: Registry,
  buildOpts: OpenApiBuildOptions,
  opts: ServeOpenApiOptions = {},
): Router {
  const router = express.Router();

  const jsonPath = opts.jsonPath ?? '/openapi.json';
  const docsPath = opts.docsPath ?? '/docs';
  const swaggerUi = opts.swaggerUi ?? true;

  let cachedDoc = buildOpenApi(registry, buildOpts);

  const getDoc = () => {
    if (opts.getRegistry) {
      return buildOpenApi(opts.getRegistry(), buildOpts);
    }
    return cachedDoc;
  };

  router.get(jsonPath, (_req: Request, res: Response) => {
    const doc = getDoc();
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(doc, null, 2));
  });

  if (swaggerUi) {
    router.get(docsPath, (_req: Request, res: Response) => {
      const cfg = JSON.stringify(
        {
          url: jsonPath,
          dom_id: '#swagger-ui',
          deepLinking: true,
          persistAuthorization: true,
          ...opts.swaggerUiConfig,
        },
        null,
        2,
      );

      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(buildOpts.title)} – API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        const config = ${cfg};
        SwaggerUIBundle(config);
      };
    </script>
  </body>
</html>`);
    });
  }

  return router;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}
