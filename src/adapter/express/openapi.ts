import type { Express } from "express";
import type { Constructor } from "../../core/types";
import { buildOpenApi } from "../../core/openapi";
import type { OpenApiExpressOptions } from "./types";

/**
 * Attaches OpenAPI endpoints to an Express application.
 * @param app - Express application instance
 * @param controllers - Array of controller classes
 * @param options - OpenAPI options
 */
export function attachOpenApi(
  app: Express,
  controllers: Constructor[],
  options: OpenApiExpressOptions
): void {
  const openApiPath = normalizePath(options.path, "/openapi.json");
  const document = buildOpenApi({
    info: options.info,
    servers: options.servers,
    controllers
  });

  app.get(openApiPath, (_req, res) => {
    res.json(document);
  });

  if (!options.docs) {
    return;
  }

  const docsOptions = typeof options.docs === "object" ? options.docs : {};
  const docsPath = normalizePath(docsOptions.path, "/docs");
  const title = docsOptions.title ?? `${options.info.title} Docs`;
  const swaggerUiUrl = (docsOptions.swaggerUiUrl ?? "https://unpkg.com/swagger-ui-dist@5").replace(
    /\/+$/,
    ""
  );

  const html = buildSwaggerUiHtml({ title, swaggerUiUrl, openApiPath });
  app.get(docsPath, (_req, res) => {
    res.type("html").send(html);
  });
}

function normalizePath(path: string | undefined, fallback: string): string {
  if (!path) {
    return fallback;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function buildSwaggerUiHtml(options: {
  title: string;
  swaggerUiUrl: string;
  openApiPath: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${options.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${options.swaggerUiUrl}/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f6f6f6;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${options.swaggerUiUrl}/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "${options.openApiPath}",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout"
        });
      };
    </script>
  </body>
</html>`;
}
