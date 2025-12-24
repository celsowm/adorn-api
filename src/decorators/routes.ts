/**
 * HTTP method decorators for defining routes
 */

import '../polyfills/symbol-metadata.js';
import { ROUTE_KEY, STATUS_KEY } from '../meta/keys.js';
import type { RouteMetadata } from '../meta/types.js';

function createRouteDecorator(method: RouteMetadata['method'], path: string) {
  return function (
    _target: object,
    context?: ClassMethodDecoratorContext
  ): void {
    // Using standard Stage 3 decorator metadata API
    if (context?.metadata) {
      // Store metadata for each method separately. 
      // Since context.metadata is shared across the class, we use a map keyed by method name.
      if (!context.metadata[ROUTE_KEY]) {
        context.metadata[ROUTE_KEY] = new Map<string | symbol, RouteMetadata>();
      }
      (context.metadata[ROUTE_KEY] as Map<string | symbol, RouteMetadata>).set(context.name, { method, path });
    }
  };
}

export function Get(path: string) {
  return createRouteDecorator('get', path);
}

export function Post(path: string) {
  return createRouteDecorator('post', path);
}

export function Put(path: string) {
  return createRouteDecorator('put', path);
}

export function Patch(path: string) {
  return createRouteDecorator('patch', path);
}

export function Delete(path: string) {
  return createRouteDecorator('delete', path);
}

export function Head(path: string) {
  return createRouteDecorator('head', path);
}

export function Options(path: string) {
  return createRouteDecorator('options', path);
}

export function Status(code: number) {
  return function (
    _target: object,
    context?: ClassMethodDecoratorContext
  ): void {
    // Using standard Stage 3 decorator metadata API
    if (context?.metadata) {
      if (!context.metadata[STATUS_KEY]) {
        context.metadata[STATUS_KEY] = new Map<string | symbol, number>();
      }
      (context.metadata[STATUS_KEY] as Map<string | symbol, number>).set(context.name, code);
    }
  };
}
