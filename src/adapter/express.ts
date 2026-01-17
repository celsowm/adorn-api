import express, { type Request, type Response, type NextFunction } from "express";
import { buildOpenApi, type OpenApiInfo, type OpenApiServer } from "../core/openapi";
import type { Constructor } from "../core/types";
import { getControllerMeta } from "../core/metadata";

export interface RequestContext<
  TBody = unknown,
  TQuery extends object | undefined = Record<string, unknown>,
  TParams extends Record<string, string | undefined> | undefined = Record<string, string | undefined>,
  THeaders extends Record<string, string | string[] | undefined> | undefined = Record<string, string | string[] | undefined>
> {
  req: Request;
  res: Response;
  body: TBody;
  query: TQuery;
  params: TParams;
  headers: THeaders;
}

export interface ExpressAdapterOptions {
  controllers: Constructor[];
  jsonBody?: boolean;
  openApi?: OpenApiExpressOptions;
}

export function createExpressApp(options: ExpressAdapterOptions): express.Express {
  const app = express();
  if (options.jsonBody ?? true) {
    app.use(express.json());
  }
  attachControllers(app, options.controllers);
  if (options.openApi) {
    attachOpenApi(app, options.controllers, options.openApi);
  }
  return app;
}

export interface OpenApiDocsOptions {
  path?: string;
  title?: string;
  swaggerUiUrl?: string;
}

export interface OpenApiExpressOptions {
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  path?: string;
  docs?: boolean | OpenApiDocsOptions;
}

export function attachControllers(app: express.Express, controllers: Constructor[]): void {
  for (const controller of controllers) {
    const meta = getControllerMeta(controller);
    if (!meta) {
      throw new Error(`Controller "${controller.name}" is missing @Controller decorator.`);
    }
    const instance = new controller();
    for (const route of meta.routes) {
      const path = joinPaths(meta.basePath, route.path);
      const handler = instance[route.handlerName as keyof typeof instance];
      if (typeof handler !== "function") {
        throw new Error(`Handler "${String(route.handlerName)}" is not a function on ${controller.name}.`);
      }
      app[route.httpMethod](path, async (req: Request, res: Response, next: NextFunction) => {
        try {
          const ctx: RequestContext = {
            req,
            res,
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers
          };
          const result = await handler.call(instance, ctx);
          if (res.headersSent) {
            return;
          }
          if (result === undefined) {
            res.status(defaultStatus(route)).end();
            return;
          }
          res.status(defaultStatus(route)).json(result);
        } catch (error) {
          next(error);
        }
      });
    }
  }
}

function attachOpenApi(
  app: express.Express,
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

function defaultStatus(route: { responses?: Array<{ status: number }> }): number {
  return route.responses?.[0]?.status ?? 200;
}

function joinPaths(basePath: string, routePath: string): string {
  const base = basePath ? basePath.replace(/\/+$/, "") : "";
  const route = routePath ? routePath.replace(/^\/+/, "") : "";
  if (!base && !route) {
    return "/";
  }
  if (!base) {
    return `/${route}`;
  }
  if (!route) {
    return base.startsWith("/") ? base : `/${base}`;
  }
  return `${base.startsWith("/") ? base : `/${base}`}/${route}`;
}

function normalizePath(path: string | undefined, fallback: string): string {
  const value = path && path.trim().length ? path.trim() : fallback;
  return value.startsWith("/") ? value : `/${value}`;
}
