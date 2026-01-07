import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute, join } from "node:path";
import swaggerUi from "swagger-ui-express";
import type { SetupSwaggerOptions } from "./types.js";

/**
 * Swagger UI configuration optimized for large specs
 */
const DEFAULT_SWAGGER_UI_OPTIONS = {
  docExpansion: "none" as const,      // Collapse all by default for better performance
  filter: true as const,               // Show filter input
  showRequestDuration: true as const,  // Show request duration
  displayRequestDuration: true as const,
  operationsSorter: "alpha" as const,  // Sort operations alphabetically
  tagsSorter: "alpha" as const,       // Sort tags alphabetically
  persistAuthorization: true as const, // Persist authorization across reloads
};

/**
 * Detect if OpenAPI spec is in split mode
 */
function isSplitMode(openapiPath: string): boolean {
  const schemasDir = join(openapiPath, "..", "schemas");
  return existsSync(schemasDir);
}

/**
 * Serve schema files from the schemas directory
 */
function createSchemaRouter(artifactsDir: string): Router {
  const router = Router();
  const schemasDir = isAbsolute(artifactsDir)
    ? resolve(artifactsDir, "schemas")
    : resolve(process.cwd(), artifactsDir, "schemas");

  router.get("/schemas/:filename", (req: Request, res: Response, next: NextFunction) => {
    const { filename } = req.params;
    const filePath = resolve(schemasDir, filename);

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "Schema file not found" });
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.send(content);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Sets up Swagger UI for API documentation
 * 
 * @param options - Swagger configuration options
 * @returns Express router with Swagger endpoints
 */
export function setupSwagger(options: SetupSwaggerOptions = {}): Router {
  const {
    artifactsDir = ".adorn",
    jsonPath = "/docs/openapi.json",
    uiPath = "/docs",
    swaggerOptions = {},
    swaggerUiOptions = {},
  } = options;

  const router = Router();

  // Get the OpenAPI file path
  const openApiPath = isAbsolute(artifactsDir)
    ? resolve(artifactsDir, "openapi.json")
    : resolve(process.cwd(), artifactsDir, "openapi.json");

  // Check if we're in split mode
  const splitMode = isSplitMode(openApiPath);

  // Serve the main OpenAPI spec
  router.get(jsonPath, (req: Request, res: Response) => {
    if (!existsSync(openApiPath)) {
      return res.status(404).json({ error: "OpenAPI spec not found" });
    }

    const content = readFileSync(openApiPath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.send(content);
  });

  // Serve schema files if in split mode
  if (splitMode) {
    router.use("/schemas", createSchemaRouter(artifactsDir));
  }

  // Configure Swagger UI with optimized settings for large specs
  const mergedSwaggerOptions = {
    ...DEFAULT_SWAGGER_UI_OPTIONS,
    ...swaggerOptions,
  };

  // Add swaggerui middleware for serving static files
  router.use(uiPath, swaggerUi.serve, swaggerUi.setup(null, {
    swaggerOptions: {
      url: jsonPath,
      ...mergedSwaggerOptions,
      // Add support for external $ref references in split mode
      supportedSubmitMethods: ["get", "put", "post", "delete", "options", "head", "patch"],
    },
    ...swaggerUiOptions,
  }));

  return router;
}

/**
 * Create a Swagger UI router with custom configuration
 * 
 * @param openapiPath - Path to the OpenAPI spec file
 * @param options - Additional Swagger UI options
 * @returns Configured Express router
 */
export function createSwaggerRouter(
  openapiPath: string,
  options: Partial<SetupSwaggerOptions> = {}
): Router {
  const artifactsDir = require("path").dirname(openapiPath);
  
  return setupSwagger({
    artifactsDir,
    ...options,
  });
}
