import { buildOpenApi } from "../../core/openapi";
import type { Constructor } from "../../core/types";
import type { OpenApiNativeOptions } from "./types";
import type { Router } from "./router";

/**
 * Registers OpenAPI endpoints with a native application router.
 */
export function registerOpenApi(
  router: Router,
  controllers: Constructor[],
  options: OpenApiNativeOptions
): void {
  const openApiPath = normalizePath(options.path, "/openapi.json");
  const document = buildOpenApi({
    info: options.info,
    servers: options.servers,
    controllers
  });

  router.add(
    {
      getOpenApi: async () => {
        return document;
      }
    },
    {
      handlerName: "getOpenApi",
      httpMethod: "get",
      path: openApiPath,
      responses: [{ status: 200, description: "OpenAPI JSON" }]
    } as any,
    ""
  );

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

  router.add(
    {
      getDocs: async () => {
        return html;
      }
    },
    {
      handlerName: "getDocs",
      httpMethod: "get",
      path: docsPath,
      raw: true,
      responses: [{ status: 200, contentType: "text/html", description: "Swagger UI" }]
    } as any,
    ""
  );
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
