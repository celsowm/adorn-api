#!/usr/bin/env node
// src/cli/serve-runtime.ts
// Runtime server implementation

import express from 'express';
import type { AdornConfig } from '../core/config.js';
import { RuntimeAPI } from '../core/runtime.js';
import { expressAdapter } from '../core/adapters/express.adapter.js';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';

export async function createRuntimeServer(config: AdornConfig, port: number): Promise<void> {
  const app = express();
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Create runtime API instance
  const runtimeConfig = {
    validationEnabled: config.runtime.validationEnabled || false,
    useClassInstantiation: config.runtime.useClassInstantiation || false,
    frameworkAdapter: expressAdapter,
  };
  
  const runtimeAPI = new RuntimeAPI(runtimeConfig);
  
  // Load controllers dynamically
  const project = new Project({ tsConfigFilePath: config.generation.tsConfig });
  const sourceFiles = project.getSourceFiles(config.generation.controllersGlob);
  
  console.log(`📂 Loading controllers from: ${config.generation.controllersGlob}`);
  
  for (const file of sourceFiles) {
    for (const classDec of file.getClasses()) {
      const className = classDec.getName();
      if (!className) continue;
      
      // Check if it's a controller
      const controllerDec = classDec.getDecorators().find(d => d.getName() === 'Controller');
      if (!controllerDec) continue;
      
      try {
        // Import controller class dynamically
        const modulePath = path.resolve(file.getFilePath().replace(/\.ts$/, '.js'));
        const controllerModule = await import(modulePath);
        const ControllerClass = controllerModule[className];
        
        if (ControllerClass) {
          runtimeAPI.registerController(ControllerClass);
          console.log(`  ✓ Loaded controller: ${className}`);
        }
      } catch (error) {
        console.warn(`  ⚠ Could not load controller ${className}:`, error);
      }
    }
  }
  
  // Register routes
  app.all('*', async (req, res, next) => {
    await runtimeAPI.handleRequest(req, res);
  });
  
  // Serve Swagger UI if available
  const swaggerPath = config.swagger.outputPath;
  if (fs.existsSync(swaggerPath)) {
    const swaggerDoc = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    console.log(`📚 Swagger UI available at http://localhost:${port}/docs`);
  } else {
    console.warn(`⚠ Swagger file not found at ${swaggerPath}`);
  }
  
  // Start server
  app.listen(port, () => {
    console.log(`\n🚀 Runtime API server running at http://localhost:${port}`);
    console.log(`📋 Registered routes:`);
    
    const routes = runtimeAPI.getRoutes();
    routes.forEach(route => {
      console.log(`  ${route.method.padEnd(6)} ${route.path} (${route.controller})`);
    });
    
    console.log('\nPress Ctrl+C to stop\n');
  });
}
