/**
 * HTTP method decorators for defining routes
 */

import '../polyfills/symbol-metadata.js';
import { ROUTE_KEY, STATUS_KEY } from '../meta/keys.js';
import type { RouteMetadata } from '../meta/types.js';

type MethodDecorator = (
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) => PropertyDescriptor | void;

function createRouteDecorator(method: RouteMetadata['method'], path: string): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    // Using standard Stage 3 decorator metadata API
    const metadata = (target as any)[Symbol.metadata] || {};
    const propertyMetadata = metadata[propertyKey] || {};
    
    propertyMetadata[ROUTE_KEY] = { method, path } as RouteMetadata;
    metadata[propertyKey] = propertyMetadata;
    (target as any)[Symbol.metadata] = metadata;
    
    return descriptor;
  };
}

export function Get(path: string): MethodDecorator {
  return createRouteDecorator('get', path);
}

export function Post(path: string): MethodDecorator {
  return createRouteDecorator('post', path);
}

export function Put(path: string): MethodDecorator {
  return createRouteDecorator('put', path);
}

export function Patch(path: string): MethodDecorator {
  return createRouteDecorator('patch', path);
}

export function Delete(path: string): MethodDecorator {
  return createRouteDecorator('delete', path);
}

export function Head(path: string): MethodDecorator {
  return createRouteDecorator('head', path);
}

export function Options(path: string): MethodDecorator {
  return createRouteDecorator('options', path);
}

export function Status(code: number): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    // Using standard Stage 3 decorator metadata API
    const metadata = (target as any)[Symbol.metadata] || {};
    const propertyMetadata = metadata[propertyKey] || {};
    
    propertyMetadata[STATUS_KEY] = code;
    metadata[propertyKey] = propertyMetadata;
    (target as any)[Symbol.metadata] = metadata;
    
    return descriptor;
  };
}
