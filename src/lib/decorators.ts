  // src/lib/decorators.ts

// 1. HTTP Methods
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

// Context metadata symbol for standard decorators
const META_KEY = Symbol('adorn:route');
const STATUS_META = Symbol('adorn:status');
export const SCHEMA_META = Symbol('adorn:schema');
export const AUTH_META = Symbol('adorn:auth');
export const PRODUCES_META = Symbol('adorn:produces');
export const ERRORS_META = Symbol('adorn:errors');
export const TAGS_META = Symbol('adorn:tags');
export const SUMMARY_META = Symbol('adorn:summary');
export const DESCRIPTION_META = Symbol('adorn:description');

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  methodName: string;
}

export interface ErrorResponse {
  statusCode: number;
  description: string;
  schema?: string; // DTO class name for the error response
}

export interface ProducesInfo {
  mimeType: string;
  description?: string;
}

// -- Method Decorator --
// Using Standard TC39 Signature
export function Get(path: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    // In standard decorators, we can attach metadata to the class prototype via context
    context.addInitializer(function () {
      const routes: RouteDefinition[] = (this as any)[META_KEY] || [];
      routes.push({
        method: 'get',
        path,
        methodName: String(context.name),
      });
      (this as any)[META_KEY] = routes;
    });
    return originalMethod;
  };
}

export function Post(path: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      const routes: RouteDefinition[] = (this as any)[META_KEY] || [];
      routes.push({
        method: 'post',
        path,
        methodName: String(context.name),
      });
      (this as any)[META_KEY] = routes;
    });
    return originalMethod;
  };
}

export function Put(path: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      const routes: RouteDefinition[] = (this as any)[META_KEY] || [];
      routes.push({
        method: 'put',
        path,
        methodName: String(context.name),
      });
      (this as any)[META_KEY] = routes;
    });
    return originalMethod;
  };
}

export function Delete(path: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      const routes: RouteDefinition[] = (this as any)[META_KEY] || [];
      routes.push({
        method: 'delete',
        path,
        methodName: String(context.name),
      });
      (this as any)[META_KEY] = routes;
    });
    return originalMethod;
  };
}

// -- Class Decorator --
export function Controller(basePath: string) {
  return function (target: any, context: ClassDecoratorContext) {
    // We attach the base path to the class constructor
    context.addInitializer(function () {
      (this as any)._basePath = basePath;
    });
    return target;
  };
}

// -- DTO Field Decorators --
// Since we can't decorate parameters, we decorate fields in a class
// e.g. class GetUserParams { @FromPath id: string }

export function FromQuery(name?: string) {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'query' };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

export function FromPath(name?: string) {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'path' };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

export function FromBody() {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'body' };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

// -- Status Code Decorator --
export function Status(code: number) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[STATUS_META] = code;
    });
    return originalMethod;
  };
}

// -- Authentication Decorator --
export function Authorized(role?: string) {
  return function (target: any, context: ClassMethodDecoratorContext | ClassDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[AUTH_META] = role || 'default';
    });
    return target;
  };
}

// -- Patch HTTP Method --
export function Patch(path: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      const routes: RouteDefinition[] = (this as any)[META_KEY] || [];
      routes.push({
        method: 'patch',
        path,
        methodName: String(context.name),
      });
      (this as any)[META_KEY] = routes;
    });
    return originalMethod;
  };
}

// -- Phase 3: Additional DTO Field Decorators --

/**
 * Marks a field to be sourced from request headers
 * @param name - Optional custom header name (defaults to field name)
 */
export function FromHeader(name?: string) {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'header', name };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

/**
 * Marks a field to be sourced from request cookies
 * @param name - Optional custom cookie name (defaults to field name)
 */
export function FromCookie(name?: string) {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'cookie', name };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

/**
 * Marks a field to be the Express Request object
 */
export function FromRequest() {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'request' };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

/**
 * Marks a field for file upload (multipart/form-data)
 * @param fieldName - Field name in the multipart form
 * @param maxCount - Maximum number of files (for array uploads)
 */
export function UploadedFile(fieldName: string, maxCount?: number) {
  return function (target: undefined, context: ClassFieldDecoratorContext) {
    context.addInitializer(function () {
      const meta = (this as any)[SCHEMA_META] || {};
      meta[context.name] = { type: 'file', fieldName, maxCount };
      (this as any)[SCHEMA_META] = meta;
    });
    return function (initialValue: any) { return initialValue; };
  };
}

// -- Phase 3: Response Metadata Decorators --

/**
 * Specifies the response content type and description
 * @param mimeType - The MIME type (e.g., 'application/json', 'application/octet-stream')
 * @param description - Optional description for Swagger
 */
export function Produces(mimeType: string, description?: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[PRODUCES_META] = { mimeType, description };
    });
    return originalMethod;
  };
}

/**
 * Specifies error responses that can occur
 * @param errors - Array of error responses with status codes and descriptions
 */
export function Errors(errors: ErrorResponse[]) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[ERRORS_META] = errors;
    });
    return originalMethod;
  };
}

/**
 * Adds tags to the endpoint for Swagger grouping
 * @param tags - Array of tag names
 */
export function Tags(...tags: string[]) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[TAGS_META] = tags;
    });
    return originalMethod;
  };
}

/**
 * Adds a summary to the endpoint for Swagger
 * @param summary - Short summary of the endpoint
 */
export function Summary(summary: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[SUMMARY_META] = summary;
    });
    return originalMethod;
  };
}

/**
 * Adds a description to the endpoint for Swagger
 * @param description - Detailed description of the endpoint
 */
export function Description(description: string) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    context.addInitializer(function () {
      (this as any)[DESCRIPTION_META] = description;
    });
    return originalMethod;
  };
}
