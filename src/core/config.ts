// src/core/config.ts
// Phase 4: Complete configuration overhaul - no backward compatibility

import type { 
  SecurityScheme, 
  SecurityRequirement, 
  SwaggerInfo,
  FrameworkAdapter,
  ValidationAdapter,
  ErrorAdapter,
  DTOFactory
} from './types.js';

export interface GenerationConfig {
  // Project structure
  rootDir: string;
  tsConfig: string;
  
  // Controller discovery
  controllersGlob: string;
  
  // Output configuration
  routesOutput?: string;
  swaggerOutput?: string;
  
  // Route configuration
  basePath?: string;
  
  // Framework configuration
  framework: 'express' | 'fastify';
  frameworkAdapter?: FrameworkAdapter;
  
  // Middleware paths
  authMiddlewarePath?: string;
  globalMiddleware?: string[];
}

export interface RuntimeConfig {
  // Framework adapter
  frameworkAdapter?: FrameworkAdapter;
  
  // Validation
  validationEnabled: boolean;
  validationAdapter?: ValidationAdapter;
  
  // Error handling
  errorAdapter?: ErrorAdapter;
  
  // DTO instantiation
  useClassInstantiation: boolean;
  dtoFactory?: DTOFactory;
}

export interface SwaggerConfig {
  enabled: boolean;
  outputPath: string;
  info: SwaggerInfo;
  securitySchemes?: Record<string, SecurityScheme>;
  defaultSecurity?: SecurityRequirement[];
  controllersGlob?: string; // Optional: separate glob for swagger
}

export interface AdornConfig {
  // Generation configuration
  generation: GenerationConfig;
  
  // Runtime configuration
  runtime: RuntimeConfig;
  
  // Swagger configuration
  swagger: SwaggerConfig;
}

export const DEFAULT_CONFIG: Partial<AdornConfig> = {
  generation: {
    rootDir: process.cwd(),
    tsConfig: './tsconfig.json',
    controllersGlob: '**/*.controller.ts',
    basePath: '',
    framework: 'express',
  },
  
  runtime: {
    validationEnabled: false,
    useClassInstantiation: false,
  },
  
  swagger: {
    enabled: true,
    outputPath: './swagger.json',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
    },
  },
};

export const DEFAULT_STATUS_CODES: Record<string, number> = {
  get: 200,
  post: 201,
  put: 200,
  delete: 204,
  patch: 200,
};
