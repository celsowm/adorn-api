// src/lib/config.ts
// Configuration types and utilities for adorn-api

export interface SwaggerInfo {
  title: string;
  version: string;
  description?: string;
}

export interface AdornConfig {
  // Project configuration
  tsConfig: string;
  
  // Controller discovery
  controllersGlob: string;
  
  // Route generation
  routesOutput: string;
  basePath?: string;
  
  // Swagger generation
  swaggerOutput: string;
  swaggerInfo: SwaggerInfo;
  
  // Middleware paths (relative to output directory)
  authMiddlewarePath: string;
}

export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  methodName: string;
  statusCode?: number; // Custom status code override
}

export const DEFAULT_STATUS_CODES: Record<string, number> = {
  get: 200,
  post: 201,
  put: 200,
  delete: 204,
};
