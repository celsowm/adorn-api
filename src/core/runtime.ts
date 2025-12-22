// src/core/runtime.ts
// Runtime metadata mode - no code generation required

import type { 
  FrameworkAdapter, 
  RequestContext, 
  ResponseBuilder,
  ControllerMetadata,
  RouteMetadata,
  FieldMetadata,
  ValidationAdapter,
  ErrorAdapter,
  DTOFactory,
} from './types.js';
import type { RuntimeConfig } from './config.js';
import { getControllerMeta, getRouteMeta, getSchemaMeta } from './decorators.js';

/**
 * Represents a registered route handler
 */
interface RouteHandler {
  controller: any;
  route: RouteMetadata;
  basePath: string;
  DTOClass?: any;
  schemaMeta: Record<string, FieldMetadata>;
}

/**
 * Runtime API server - no code generation needed
 */
export class RuntimeAPI {
  private config: RuntimeConfig;
  private routes: RouteHandler[] = [];
  private frameworkAdapter: FrameworkAdapter;
  
  constructor(config: RuntimeConfig) {
    this.config = config;
    this.frameworkAdapter = config.frameworkAdapter || this.getDefaultAdapter();
  }
  
  private getDefaultAdapter(): FrameworkAdapter {
    // Default to Express if no adapter provided
    const { expressAdapter } = require('./adapters/express.adapter.js');
    return expressAdapter;
  }
  
  /**
   * Register a controller class
   */
  registerController(ControllerClass: any): void {
    const meta = getControllerMeta(ControllerClass);
    if (!meta) {
      throw new Error(`Class ${ControllerClass.name} is not decorated with @Controller`);
    }
    
    const routes = getRouteMeta(ControllerClass);
    
    for (const route of routes) {
      // Find DTO class by inspecting method parameters
      const DTOClass = this.findDTOClass(ControllerClass, route.methodName);
      const schemaMeta = DTOClass ? getSchemaMeta(DTOClass) : {};
      
      this.routes.push({
        controller: new ControllerClass(),
        route,
        basePath: meta.basePath,
        DTOClass,
        schemaMeta,
      });
    }
  }
  
  /**
   * Find DTO class for a method
   * Note: In runtime mode without code generation, users must manually register DTOs
   * or use a different approach. This is a placeholder for future enhancement.
   */
  private findDTOClass(ControllerClass: any, methodName: string): any {
    // Without emitDecoratorMetadata, we can't auto-detect DTO classes
    // Users will need to use a different approach or code generation
    return undefined;
  }
  
  /**
   * Handle a request
   */
  async handleRequest(req: any, res: any): Promise<void> {
    const request = this.frameworkAdapter.extractRequest(req);
    const response = this.frameworkAdapter.createResponseBuilder(res);
    
    // Find matching route
    const path = req.path;
    const method = req.method.toLowerCase();
    
    const handler = this.routes.find(h => {
      const fullPath = this.normalizePath(h.basePath, h.route.path);
      return h.route.method === method && this.matchPath(fullPath, path);
    });
    
    if (!handler) {
      return response.status(404).json({ error: 'Not Found' });
    }
    
    try {
      // Extract parameters
      const dto = await this.buildDTO(handler, request);
      
      // Validate if enabled
      if (this.config.validationEnabled && this.config.validationAdapter) {
        await this.config.validationAdapter.validate(dto, handler.DTOClass);
      }
      
      // Call controller method
      const result = await handler.controller[handler.route.methodName](dto);
      
      // Build response
      const statusCode = handler.route.statusCode || this.getDefaultStatusCode(handler.route.method);
      
      if (handler.route.produces && handler.route.produces !== 'application/json') {
        // Non-JSON response
        response.status(statusCode).send(result);
      } else {
        response.status(statusCode).json(result);
      }
    } catch (error) {
      this.handleError(error, request, response);
    }
  }
  
  /**
   * Build DTO from request
   */
  private async buildDTO(handler: RouteHandler, request: RequestContext): Promise<any> {
    if (!handler.DTOClass) return undefined;
    
    const schemaMeta = handler.schemaMeta;
    const data: any = {};
    
    for (const [field, meta] of Object.entries(schemaMeta)) {
      switch (meta.type) {
        case 'query':
          data[field] = this.extractFromSource(request.query, field, meta.name);
          break;
        case 'path':
          data[field] = this.extractFromSource(request.params, field, meta.name);
          break;
        case 'body':
          data[field] = request.body;
          break;
        case 'header':
          data[field] = this.extractFromSource(request.headers, field, meta.name);
          break;
        case 'cookie':
          data[field] = this.extractFromSource(request.cookies, field, meta.name);
          break;
        case 'request':
          data[field] = request.request;
          break;
        case 'file':
          data[field] = request.files?.[meta.fieldName || field];
          break;
      }
    }
    
    // Create DTO instance or plain object
    if (this.config.useClassInstantiation) {
      if (this.config.dtoFactory) {
        return this.config.dtoFactory.create(handler.DTOClass, data);
      }
      
      const instance = new handler.DTOClass();
      Object.assign(instance, data);
      return instance;
    }
    
    return data;
  }
  
  private extractFromSource(source: any, field: string, customName?: string): any {
    const key = customName || field;
    return source?.[key];
  }
  
  private normalizePath(basePath: string, routePath: string): string {
    const cleanBase = basePath.replace(/\/+$/, '');
    const cleanRoute = routePath.replace(/^\/+/, '');
    return `/${cleanBase}/${cleanRoute}`;
  }
  
  private matchPath(routePath: string, requestPath: string): boolean {
    // Simple path matching (could be enhanced for parameter matching)
    const routeSegments = routePath.split('/').filter(Boolean);
    const requestSegments = requestPath.split('/').filter(Boolean);
    
    if (routeSegments.length !== requestSegments.length) {
      return false;
    }
    
    for (let i = 0; i < routeSegments.length; i++) {
      if (routeSegments[i].startsWith(':') || routeSegments[i].startsWith('{')) {
        // Parameter - matches any value
        continue;
      }
      if (routeSegments[i] !== requestSegments[i]) {
        return false;
      }
    }
    
    return true;
  }
  
  private getDefaultStatusCode(method: string): number {
    const defaults: Record<string, number> = {
      get: 200,
      post: 201,
      put: 200,
      delete: 204,
      patch: 200,
    };
    return defaults[method] || 200;
  }
  
  private handleError(error: any, request: RequestContext, response: ResponseBuilder): void {
    console.error('Error handling request:', error);
    
    if (this.config.errorAdapter) {
      const adapted = this.config.errorAdapter.handleError(error);
      return response.status(adapted.statusCode).json({
        error: adapted.message,
        details: adapted.details,
      });
    }
    
    // Default error handling
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    
    response.status(statusCode).json({ error: message });
  }
  
  /**
   * Get all registered routes (for testing/debugging)
   */
  getRoutes(): Array<{ path: string; method: string; controller: string }> {
    return this.routes.map(h => ({
      path: this.normalizePath(h.basePath, h.route.path),
      method: h.route.method.toUpperCase(),
      controller: h.controller.constructor.name,
    }));
  }
}

/**
 * Factory function to create a RuntimeAPI instance
 */
export function createRuntimeAPI(config: RuntimeConfig): RuntimeAPI {
  return new RuntimeAPI(config);
}
