// src/core/types.ts
// Core types for the shared package - used by both CLI and runtime

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export interface RouteMetadata {
  method: HttpMethod;
  path: string;
  methodName: string;
  statusCode?: number;
  produces?: string;
  errors?: ErrorResponse[];
  tags?: string[];
  summary?: string;
  description?: string;
  auth?: string | boolean;
}

export interface ControllerMetadata {
  basePath: string;
  routes: RouteMetadata[];
  tags?: string[];
  auth?: string | boolean;
}

export interface FieldMetadata {
  type: 'query' | 'path' | 'body' | 'header' | 'cookie' | 'request' | 'file';
  name?: string;
  fieldName?: string;
  maxCount?: number;
}

export interface ErrorResponse {
  statusCode: number;
  description: string;
  schema?: string;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'header' | 'query';
  scheme?: string;
  bearerFormat?: string;
  flows?: any;
  openIdConnectUrl?: string;
}

export interface SecurityRequirement {
  [name: string]: string[] | undefined;
}

export interface SwaggerInfo {
  title: string;
  version: string;
  description?: string;
}

// Runtime adapter interfaces
export interface RequestContext {
  request: any;
  response: any;
  params: Record<string, any>;
  query: Record<string, any>;
  headers: Record<string, any>;
  cookies: Record<string, any>;
  body: any;
  files?: Record<string, any>;
}

export interface ResponseBuilder {
  status(code: number): ResponseBuilder;
  json(data: any): void;
  send(data: any): void;
  end(): void;
  header(name: string, value: string): ResponseBuilder;
}

export interface FrameworkAdapter {
  name: string;
  extractRequest(req: any): RequestContext;
  createResponseBuilder(res: any): ResponseBuilder;
  applyMiddleware(req: any, res: any, next: (err?: any) => void, middleware: any[]): void;
}

export interface ValidationAdapter {
  validate<T>(dto: T, DTOClass?: new () => T): Promise<void>;
}

export interface ErrorAdapter {
  handleError(error: any): { statusCode: number; message: string; details?: any };
}

export interface DTOFactory {
  create<T>(DTOClass: new () => T, data: any): T;
}
