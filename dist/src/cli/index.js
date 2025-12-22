#!/usr/bin/env node
// src/cli/index.ts
// Main CLI entry point for adorn-api
import { Command } from "commander";
import { generateRoutes } from "./generate-routes.js";
import { generateSwagger } from "./generate-swagger.js";
import { loadConfig } from "../lib/load-config.js";
const program = new Command();
program
    .name("adorn-api")
    .description("TypeScript API framework with automatic route and Swagger generation")
    .version("1.1.0");
program
    .command("gen")
    .description("Generate routes and Swagger documentation")
    .option("-c, --config <path>", "Path to configuration file")
    .option("--routes", "Generate routes only")
    .option("--swagger", "Generate Swagger only")
    .action(async (options) => {
    try {
        const config = await loadConfig(options.config);
        if (options.swagger || !options.routes) {
            console.log("🔍 Generating Swagger documentation...");
            await generateSwagger(config);
        }
        if (options.routes || !options.swagger) {
            console.log("🛣️  Generating routes...");
            await generateRoutes(config);
        }
        console.log("✅ Generation complete!");
    }
    catch (error) {
        console.error("❌ Error during generation:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program
    .command("gen:routes")
    .description("Generate Express routes only")
    .option("-c, --config <path>", "Path to configuration file")
    .action(async (options) => {
    try {
        const config = await loadConfig(options.config);
        await generateRoutes(config);
        console.log("✅ Routes generated successfully!");
    }
    catch (error) {
        console.error("❌ Error generating routes:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program
    .command("gen:swagger")
    .description("Generate Swagger documentation only")
    .option("-c, --config <path>", "Path to configuration file")
    .action(async (options) => {
    try {
        const config = await loadConfig(options.config);
        await generateSwagger(config);
        console.log("✅ Swagger documentation generated successfully!");
    }
    catch (error) {
        console.error("❌ Error generating Swagger:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program.parse();
