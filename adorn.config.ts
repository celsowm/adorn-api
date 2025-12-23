// adorn.config.ts
// Phase 4: New configuration structure - Breaking changes

import type { AdornConfig } from './dist/src/core/config.js';
import { expressAdapter } from './dist/src/core/adapters/express.adapter.js';

const config: AdornConfig = {
  // Code generation configuration
  generation: {
    rootDir: process.cwd(),
    tsConfig: './tsconfig.json',
    controllersGlob: 'tests/example-app/controllers/**/*.ts',
    basePath: '/api',
    framework: 'express',
    routesOutput: './tests/example-app/routes.ts',
    authMiddlewarePath: './tests/example-app/middleware/auth.middleware.ts',
    globalMiddleware: [],
  },
  
  // Runtime configuration (for runtime mode)
  runtime: {
    frameworkAdapter: expressAdapter,
    validationEnabled: false,
    useClassInstantiation: false,
    // validationAdapter: customValidationAdapter, // Optional
    // errorAdapter: customErrorAdapter, // Optional
    // dtoFactory: customDTOFactory, // Optional
  },
  
  // Swagger configuration
  swagger: {
    enabled: true,
    outputPath: './swagger.json',
    info: {
      title: 'Adorn API Documentation',
      version: '2.0.0',
      description: 'Phase 4 API with runtime and code generation modes',
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    defaultSecurity: [{ bearerAuth: [] }],
  },
};

export default config;
