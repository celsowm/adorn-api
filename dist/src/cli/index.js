#!/usr/bin/env node
// src/cli/index.ts
// Phase 4: Main CLI entry point - Breaking changes
import { Command } from "commander";
import { loadConfig } from "../lib/load-config.js";
import { generateRoutes } from "./generate-routes.js";
import { generateSwagger } from "./generate-swagger.js";
import { createRuntimeServer } from "./serve-runtime.js";
const program = new Command();
program
    .name("adorn-api")
    .description("Phase 4: TypeScript API framework with code generation and runtime mode")
    .version("2.0.0");
program
    .command("gen")
    .description("Generate routes and Swagger documentation (code generation mode)")
    .option("-c, --config <path>", "Path to configuration file", "./adorn.config.ts")
    .option("--routes", "Generate routes only")
    .option("--swagger", "Generate Swagger only")
    .action(async (options) => {
    try {
        const config = await loadConfig(options.config);
        const generateRoutesOnly = options.routes && !options.swagger;
        const generateSwaggerOnly = options.swagger && !options.routes;
        console.log("🔨 Starting generation...");
        if (generateSwaggerOnly || !generateRoutesOnly) {
            await generateSwagger(config);
        }
        if (generateRoutesOnly || !generateSwaggerOnly) {
            await generateRoutes(config);
        }
        console.log("✅ Generation complete!");
    }
    catch (error) {
        console.error("❌ Error during generation:", error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
});
program
    .command("serve")
    .description("Run in runtime mode (no code generation)")
    .option("-c, --config <path>", "Path to configuration file", "./adorn.config.ts")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .action(async (options) => {
    try {
        const config = await loadConfig(options.config);
        const port = parseInt(options.port, 10);
        await createRuntimeServer(config, port);
    }
    catch (error) {
        console.error("❌ Error starting server:", error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
});
program.parse();
