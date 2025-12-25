import { ensureDecoratorMetadata } from '../runtime/metadataPolyfill.js';
import type { SchemaRef } from './schema.js';
import type { Guard, IncludePolicy, RouteStub } from './metadata.js';
import { pushRouteStub, writeControllerMeta } from './metadata.js';
import { RouteConfigError } from './errors.js';

ensureDecoratorMetadata();

export type ControllerOptions = {
  tags?: string[];
};

export function Controller(basePath: string, opts: ControllerOptions = {}): <T extends Function>(value: T, _context: ClassDecoratorContext) => T {
  return function <T extends Function>(value: T, _context: ClassDecoratorContext) {
    writeControllerMeta(_context.metadata, { basePath, tags: opts.tags ?? [] });
    return value;
  };
}

export type RouteOptions = {
  params?: SchemaRef;
  query: SchemaRef;
  body?: SchemaRef;
  response: SchemaRef;
  includePolicy?: IncludePolicy;
  guards?: Guard[];
};

function http(method: string, path: string, opts: RouteOptions): (value: Function, _context: ClassMethodDecoratorContext) => void {
  return function (value: Function, _context: ClassMethodDecoratorContext) {
    if (_context.kind !== 'method')
      throw new RouteConfigError(`@${method} can only decorate methods`);

    if (typeof _context.name !== 'string') {
      throw new RouteConfigError(`Decorated method name must be a string (got symbol)`);
    }

    const routeStub: RouteStub = {
      method,
      path,
      handlerName: _context.name,
      schemas: {
        params: opts.params,
        query: opts.query,
        body: opts.body,
        response: opts.response,
      },
      guards: opts.guards ?? [],
    };

    if (opts.includePolicy) {
      routeStub.includePolicy = opts.includePolicy;
    }

    pushRouteStub(_context.metadata, routeStub);

    return;
  };
}

export const Get = (path: string, opts: RouteOptions): (value: Function, _context: ClassMethodDecoratorContext) => void => http('GET', path, opts);
export const Post = (path: string, opts: RouteOptions): (value: Function, _context: ClassMethodDecoratorContext) => void => http('POST', path, opts);
export const Put = (path: string, opts: RouteOptions): (value: Function, _context: ClassMethodDecoratorContext) => void => http('PUT', path, opts);
export const Patch = (path: string, opts: RouteOptions): (value: Function, _context: ClassMethodDecoratorContext) => void => http('PATCH', path, opts);
export const Delete = (path: string, opts: RouteOptions): (value: Function, _context: ClassMethodDecoratorContext) => void => http('DELETE', path, opts);
