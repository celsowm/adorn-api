// src/core/config.ts
// Phase 4: Configuration foundation for code generation + runtime

import type {
  FrameworkAdapter,
  ValidationAdapter,
  ErrorAdapter,
  DTOFactory,
  SecurityScheme,
  SecurityRequirement,
  SwaggerInfo,
} from './types.js';

export interface GenerationConfig {
  rootDir: string;
  tsConfig: string;
  controllersGlob: string;
  routesOutput: string;
  basePath?: string;
  framework: 'express' | 'fastify';
  frameworkAdapter?: FrameworkAdapter;
  authMiddlewarePath?: string;
  globalMiddleware?: string[];
}

export interface RuntimeConfig {
  frameworkAdapter?: FrameworkAdapter;
  validationEnabled?: boolean;
  validationLibrary?: 'zod' | 'class-validator' | 'none';
  validationPath?: string;
  validationAdapter?: ValidationAdapter;
  errorAdapterPath?: string;
  errorAdapter?: ErrorAdapter;
  authAdapter?: any;
  useClassInstantiation?: boolean;
  dtoFactory?: DTOFactory;
}

export interface SwaggerConfig {
  enabled: boolean;
  outputPath: string;
  info: SwaggerInfo;
  securitySchemes?: Record<string, SecurityScheme>;
  defaultSecurity?: SecurityRequirement[];
  controllersGlob?: string;
}

export interface AdornConfig {
  generation: GenerationConfig;
  runtime: RuntimeConfig;
  swagger: SwaggerConfig;
}

export const DEFAULT_CONFIG: Partial<AdornConfig> = {
  generation: {
    rootDir: process.cwd(),
    tsConfig: './tsconfig.json',
    controllersGlob: 'src/controllers/**/*.ts',
    routesOutput: './src/routes.generated.ts',
    basePath: '',
    framework: 'express',
    globalMiddleware: [],
  },
  runtime: {
    validationEnabled: false,
    validationLibrary: 'none',
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
