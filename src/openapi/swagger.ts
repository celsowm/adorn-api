import type { OpenApiDocument } from './builder.js';

export const swaggerHtml = (specUrl: string, title = 'Swagger UI'): string => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        SwaggerUIBundle({
          url: '${specUrl}',
          dom_id: '#swagger-ui'
        });
      };
    </script>
  </body>
</html>
`;

export const createSwaggerUiHandler = (spec: OpenApiDocument, specPath = '/openapi.json') => {
  return {
    specPath,
    spec,
    html: swaggerHtml(specPath)
  };
};
