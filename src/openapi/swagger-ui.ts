import type { Application } from "express";
import type { OpenApiSpec } from "../types/openapi.js";
import swaggerUi from "swagger-ui-express";

export interface SwaggerUiOptions {
  swaggerPath?: string;
  jsonPath?: string;
  title?: string;
  persistAuthorization?: boolean;
}

export function setupSwaggerUi(
  app: Application,
  spec: OpenApiSpec,
  options?: SwaggerUiOptions,
): void {
  const swaggerPath = options?.swaggerPath ?? "/swagger";
  const jsonPath = options?.jsonPath ?? "/swagger.json";

  app.use(jsonPath, (_req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    res.json(spec);
    next();
  });

  app.use(swaggerPath, swaggerUi.serve);

  app.get(
    swaggerPath,
    swaggerUi.setup(spec, {
      swaggerOptions: {
        url: jsonPath,
        persistAuthorization: options?.persistAuthorization ?? true,
      },
      customSiteTitle: options?.title ?? spec.info.title,
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );
}
