// src/core/decorators.ts
// Phase 4: Refactored decorators with unified metadata storage

import type { 
  HttpMethod, 
  RouteMetadata, 
  ControllerMetadata, 
  FieldMetadata 
} from './types.js';

// Metadata storage keys
const CONTROLLER_META_KEY = Symbol('adorn:controller');
const ROUTE_META_KEY = Symbol('adorn:routes');
const SCHEMA_META_KEY = Symbol('adorn:schema');
const STATUS_META_KEY = Symbol('adorn:status');
const AUTH_META_KEY = Symbol('adorn:auth');
const PRODUCES_META_KEY = Symbol('adorn:produces');
const ERRORS_META_KEY = Symbol('adorn:errors');
const TAGS_META_KEY = Symbol('adorn:tags');
const SUMMARY_META_KEY = Symbol('adorn:summary');
const DESCRIPTION_META_KEY = Symbol('adorn:description');

// Helper to get/set metadata on classes
function getControllerMetadata(target: any): ControllerMetadata {
  const meta = target[CONTROLLER_META_KEY] as ControllerMetadata | undefined;
  if (meta) return meta;
  
  const newMeta: ControllerMetadata = {
    basePath: '',
    routes: [],
  };
  target[CONTROLLER_META_KEY] = newMeta;
  return newMeta;
}

function getRouteMetadata(target: any): RouteMetadata[] {
  const meta = target[ROUTE_META_KEY] as RouteMetadata[] | undefined;
  if (meta) return meta;
  
  const newMeta: RouteMetadata[] = [];
  target[ROUTE_META_KEY] = newMeta;
  return newMeta;
}

function getSchemaMetadata(target: any): Record<string, FieldMetadata> {
  const meta = target[SCHEMA_META_KEY] as Record<string, FieldMetadata> | undefined;
  if (meta) return meta;
  
  const newMeta: Record<string, FieldMetadata> = {};
  target[SCHEMA_META_KEY] = newMeta;
  return newMeta;
}

// ==================== CLASS DECORATORS ====================

/**
 * Marks a class as a controller with a base path
 * @param basePath - The base path for all routes in this controller
 */
export function Controller(basePath: string): ClassDecorator {
  return function (target: any) {
    const meta = getControllerMetadata(target);
    meta.basePath = basePath;
  };
}

/**
 * Marks a controller as requiring authentication
 * @param role - Optional role requirement
 */
export function Authorized(role?: string): ClassDecorator {
  return function (target: any) {
    const meta = getControllerMetadata(target);
    meta.auth = role || true;
  };
}

/**
 * Adds tags to all routes in the controller
 */
export function Tags(...tags: string[]): ClassDecorator {
  return function (target: any) {
    const meta = getControllerMetadata(target);
    meta.tags = tags;
  };
}

// ==================== METHOD DECORATORS ====================

/**
 * Creates an HTTP method decorator
 */
function createHttpMethodDecorator(method: HttpMethod) {
  return function (path: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const routes = getRouteMetadata(target);
      routes.push({
        method,
        path,
        methodName: String(propertyKey),
      });
    };
  };
}

export const Get = createHttpMethodDecorator('get');
export const Post = createHttpMethodDecorator('post');
export const Put = createHttpMethodDecorator('put');
export const Delete = createHttpMethodDecorator('delete');
export const Patch = createHttpMethodDecorator('patch');

/**
 * Sets a custom status code for the response
 */
export function Status(code: number): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.statusCode = code;
    }
  };
}

/**
 * Marks a route as requiring authentication
 */
export function AuthorizedRoute(role?: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.auth = role || true;
    }
  };
}

/**
 * Specifies the response content type
 */
export function Produces(mimeType: string, description?: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.produces = mimeType;
    }
  };
}

/**
 * Specifies error responses
 */
export function Errors(errors: any[]): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.errors = errors;
    }
  };
}

/**
 * Adds tags to the route
 */
export function RouteTags(...tags: string[]): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.tags = tags;
    }
  };
}

/**
 * Adds a summary to the route
 */
export function Summary(summary: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.summary = summary;
    }
  };
}

/**
 * Adds a description to the route
 */
export function Description(description: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const routes = getRouteMetadata(target);
    const route = routes.find(r => r.methodName === String(propertyKey));
    if (route) {
      route.description = description;
    }
  };
}

// ==================== FIELD DECORATORS ====================

/**
 * Type for field decorators
 */
type FieldDecorator = (target: any, propertyKey: string | symbol) => void;

/**
 * Marks a field to be sourced from query parameters
 */
export function FromQuery(name?: string): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'query', name };
  };
}

/**
 * Marks a field to be sourced from path parameters
 */
export function FromPath(name?: string): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'path', name };
  };
}

/**
 * Marks a field to be sourced from the request body
 */
export function FromBody(): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'body' };
  };
}

/**
 * Marks a field to be sourced from request headers
 */
export function FromHeader(name?: string): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'header', name };
  };
}

/**
 * Marks a field to be sourced from request cookies
 */
export function FromCookie(name?: string): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'cookie', name };
  };
}

/**
 * Marks a field to be the request object
 */
export function FromRequest(): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'request' };
  };
}

/**
 * Marks a field for file upload
 */
export function UploadedFile(fieldName: string, maxCount?: number): FieldDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const schema = getSchemaMetadata(target);
    schema[String(propertyKey)] = { type: 'file', fieldName, maxCount };
  };
}

// ==================== METADATA ACCESS ====================

/**
 * Gets controller metadata for a class
 */
export function getControllerMeta(target: any): ControllerMetadata | undefined {
  return target[CONTROLLER_META_KEY] as ControllerMetadata | undefined;
}

/**
 * Gets route metadata for a class
 */
export function getRouteMeta(target: any): RouteMetadata[] {
  return (target[ROUTE_META_KEY] as RouteMetadata[]) || [];
}

/**
 * Gets schema metadata for a class
 */
export function getSchemaMeta(target: any): Record<string, FieldMetadata> {
  return (target[SCHEMA_META_KEY] as Record<string, FieldMetadata>) || {};
}

// Export metadata keys for external access
export const META_KEYS = {
  CONTROLLER: CONTROLLER_META_KEY,
  ROUTE: ROUTE_META_KEY,
  SCHEMA: SCHEMA_META_KEY,
  STATUS: STATUS_META_KEY,
  AUTH: AUTH_META_KEY,
  PRODUCES: PRODUCES_META_KEY,
  ERRORS: ERRORS_META_KEY,
  TAGS: TAGS_META_KEY,
  SUMMARY: SUMMARY_META_KEY,
  DESCRIPTION: DESCRIPTION_META_KEY,
};
