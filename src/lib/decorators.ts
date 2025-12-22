// src/lib/decorators.ts

// 1. HTTP Methods
export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

// Context metadata symbol for standard decorators
const META_KEY = Symbol('adorn:route');
const STATUS_META = Symbol('adorn:status');
export const SCHEMA_META = Symbol('adorn:schema');
export const AUTH_META = Symbol('adorn:auth');

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  methodName: string;
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
