import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import swaggerUi from "swagger-ui-express";
import type { SetupSwaggerOptions } from "./types.js";

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

    router.get(jsonPath, (req, res) => {
        const openApiPath = isAbsolute(artifactsDir)
            ? resolve(artifactsDir, "openapi.json")
            : resolve(process.cwd(), artifactsDir, "openapi.json");

        const content = readFileSync(openApiPath, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.send(content);
    });

    router.use(uiPath, swaggerUi.serve, swaggerUi.setup(null, {
        swaggerOptions: {
            url: jsonPath,
            ...swaggerOptions,
        },
        ...swaggerUiOptions,
    }));

    return router;
}
