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
  .action(async (options: any) => {
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
    } catch (error) {
      console.error("❌ Error during generation:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command("serve")
  .description("Run in runtime mode (no code generation) or codegen mode with --gen option")
  .option("-c, --config <path>", "Path to configuration file", "./adorn.config.ts")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .option("--gen", "Run code generation before starting server (dev mode)")
  .action(async (options: any) => {
    try {
      const config = await loadConfig(options.config);
      const port = parseInt(options.port, 10);
      
      // Auto-generate code if --gen flag is provided
      if (options.gen) {
        console.log("🔨 Running code generation in dev mode...\n");
        await generateRoutes(config);
        await generateSwagger(config);
        console.log("✅ Code generation complete!\n");
      }
      
      console.log(`📋 Serve mode: ${options.gen ? 'Codegen (generated routes)' : 'Runtime (reflection)'}\n`);
      await createRuntimeServer(config, port);
    } catch (error) {
      console.error("❌ Error starting server:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
