// src/lib/config.ts
// Configuration types and utilities for adorn-api

export interface SwaggerInfo {
  title: string;
  version: string;
  description?: string;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string; // For apiKey
  in?: 'header' | 'query'; // For apiKey
  scheme?: string; // For http
  bearerFormat?: string; // For http bearer
  flows?: any; // For oauth2
  openIdConnectUrl?: string; // For openIdConnect
}

export interface SecurityRequirement {
  [name: string]: string[] | undefined;
}

export interface AdornConfig {
  // Project configuration
  tsConfig: string;
  
  // Controller discovery
  controllersGlob: string;
  swaggerControllersGlob?: string; // Optional: separate glob for swagger to scan
  
  // Route generation
  routesOutput: string;
  basePath?: string;
  
  // Swagger generation
  swaggerOutput: string;
  swaggerInfo: SwaggerInfo;
  securitySchemes?: Record<string, SecurityScheme>; // Custom security schemes
  defaultSecurity?: SecurityRequirement[]; // Default security requirements
  
  // Middleware paths (relative to output directory)
  authMiddlewarePath: string;
  
  // Adapter configuration (optional)
  useClassInstantiation?: boolean; // If true, DTOs will be instantiated as classes
  errorAdapterPath?: string; // Path to custom error adapter
  
  // Phase 3: Validation configuration
  validationLibrary?: 'zod' | 'class-validator' | 'none'; // Default: 'none'
  validationPath?: string; // Path to validation adapter
  validationEnabled?: boolean; // Enable automatic validation (default: false)
}

export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  methodName: string;
  statusCode?: number; // Custom status code override
}

export const DEFAULT_STATUS_CODES: Record<string, number> = {
  get: 200,
  post: 201,
  put: 200,
  delete: 204,
  patch: 200,
};
