// src/lib/adapters.ts
// Runtime adapters for auth, middleware injection, and DTO factories

import type { Request, Response, NextFunction } from 'express';
import type { AdornConfig } from '../core/config.js';

/**
 * Auth adapter interface for custom authentication middleware
 * Allows projects to plug in Express/Fastify middleware instead of hard-coded paths
 */
export interface AuthAdapter {
  /**
   * Returns authentication middleware for Express
   * @param role - Optional role specified in @Authorized decorator
   */
  getMiddleware(role?: string): (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Default auth adapter that imports from configured path
 */
export class DefaultAuthAdapter implements AuthAdapter {
  constructor(private authMiddlewarePath: string) {}

  getMiddleware(role?: string): (req: Request, res: Response, next: NextFunction) => void {
    // Dynamically import the auth middleware
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const middleware = require(this.authMiddlewarePath);
    const authFn = middleware.authenticationMiddleware || middleware.default;
    
    if (typeof authFn !== 'function') {
      throw new Error(`Auth middleware at ${this.authMiddlewarePath} must export authenticationMiddleware function`);
    }
    
    return authFn;
  }
}

/**
 * Error mapping adapter for custom error handling
 * Allows projects to transform errors before they reach error handlers
 */
export interface ErrorAdapter {
  /**
   * Transforms an error before it's passed to next(err)
   * Can add status codes, clean messages, or re-throw different error types
   */
  handleError(err: Error): Error;
}

/**
 * Default error adapter - passes errors through unchanged
 */
export class DefaultErrorAdapter implements ErrorAdapter {
  handleError(err: Error): Error {
    return err;
  }
}

/**
 * DTO factory for instantiating parameter objects
 * Allows defaults and class methods to run properly
 */
export interface DTOFactory {
  /**
   * Instantiates a DTO class with the provided data
   * @param DTOClass - The DTO constructor
   * @param data - Raw data from request (query, params, body)
   * @returns Instantiated DTO instance
   */
  instantiate<T>(DTOClass: new () => T, data: any): T;
}

/**
 * DTO factory that instantiates classes
 * Enables defaults and class methods to work
 */
export class ClassInstantiatingDTOFactory implements DTOFactory {
  instantiate<T>(DTOClass: new () => T, data: any): T {
    const instance = new DTOClass();
    // Merge data into the instance
    Object.assign(instance as any, data);
    return instance;
  }
}

/**
 * Context adapter for request-scoped data
 * Allows injecting request context, user info, etc.
 */
export interface RequestContext {
  req: Request;
  res: Response;
  [key: string]: any;
}

/**
 * Middleware registry for global and per-controller middleware
 */
export interface MiddlewareRegistry {
  global: Array<(req: Request, res: Response, next: NextFunction) => void>;
  controllers: Map<string, Array<(req: Request, res: Response, next: NextFunction) => void>>;
}

/**
 * Runtime adapter configuration
 * Projects can provide custom implementations for each adapter
 */
export interface RuntimeAdapters {
  auth?: AuthAdapter;
  error?: ErrorAdapter;
  dto?: DTOFactory;
  validation?: ValidationAdapter;
}

/**
 * Validation adapter interface for request validation
 * Allows projects to integrate Zod, class-validator, or custom validation logic
 */
export interface ValidationAdapter {
  /**
   * Validates a DTO instance
   * @param dto - The DTO instance to validate
   * @param DTOClass - The DTO constructor class (for class-validator)
   * @throws Error with validation details if validation fails
   */
  validate<T>(dto: T, DTOClass?: new () => T): Promise<void>;
}

/**
 * Default validation adapter - no validation (passes through)
 * Used when validation is not enabled
 */
export class DefaultValidationAdapter implements ValidationAdapter {
  async validate<T>(_dto: T, _DTOClass?: new () => T): Promise<void> {
    // No validation - pass through
  }
}

/**
 * Zod validation adapter
 * Validates DTOs using Zod schemas
 * Assumes DTO classes have a static `schema` property with a Zod schema
 */
export class ZodValidationAdapter implements ValidationAdapter {
  async validate<T>(dto: T, DTOClass?: any): Promise<void> {
    if (!DTOClass) {
      throw new Error('DTOClass is required for Zod validation');
    }

    const schema = DTOClass.schema;
    if (!schema) {
      throw new Error(`DTO class ${DTOClass.name} must have a static 'schema' property with a Zod schema`);
    }

    try {
      // Dynamic import of zod
      const zod = await import('zod');
      const parsed = schema.parse(dto);
      
      // If parsing succeeds, we're good
      return parsed;
    } catch (error) {
      if (error && typeof error === 'object' && 'issues' in error) {
        // Zod validation error - format nicely
        const issues = error.issues as Array<{ path: (string | number)[]; message: string }>;
        const messages = issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        const validationError = new Error(`Validation failed: ${messages}`) as any;
        validationError.statusCode = 400;
        validationError.name = 'ValidationError';
        validationError.details = issues;
        throw validationError;
      }
      throw error;
    }
  }
}

/**
 * Class-validator validation adapter
 * Validates DTOs using class-validator decorators
 * 
 * Note: Requires 'class-validator' package to be installed:
 * npm install class-validator
 */
export class ClassValidatorAdapter implements ValidationAdapter {
  async validate<T>(dto: T, DTOClass?: new () => T): Promise<void> {
    if (!DTOClass) {
      throw new Error('DTOClass is required for class-validator validation');
    }

    try {
      // Dynamic import of class-validator (optional dependency)
      // @ts-ignore - class-validator is optional and may not be installed
      const classValidatorModule: any = await import('class-validator');
      const validate = classValidatorModule.validate || classValidatorModule.default?.validate;
      
      if (typeof validate !== 'function') {
        throw new Error('class-validator module must export a validate function');
      }
      
      const errors = await validate(dto as object);

      if (errors.length > 0) {
        const messages = errors.map((err: any) => {
          const constraints = Object.values(err.constraints || {}).join(', ');
          return `${err.property}: ${constraints}`;
        }).join('; ');
        
        const validationError = new Error(`Validation failed: ${messages}`) as any;
        validationError.statusCode = 400;
        validationError.name = 'ValidationError';
        validationError.details = errors;
        throw validationError;
      }
    } catch (error) {
      if ((error as any).name === 'ValidationError') {
        throw error;
      }
      throw new Error(`Validation error: ${(error as Error).message}`);
    }
  }
}

/**
 * Factory function to create validation adapter based on config
 */
export function createValidationAdapter(config: AdornConfig): ValidationAdapter {
  const library = config.runtime.validationLibrary || 'none';
  
  if (!config.runtime.validationEnabled || library === 'none') {
    return new DefaultValidationAdapter();
  }

  // If custom validation path is provided, use it
  if (config.runtime.validationPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const CustomAdapter = require(config.runtime.validationPath);
      const adapter = CustomAdapter.default || CustomAdapter;
      
      if (typeof adapter.validate !== 'function') {
        throw new Error(`Validation adapter at ${config.runtime.validationPath} must implement ValidationAdapter interface`);
      }
      
      return new adapter();
    } catch (error) {
      console.warn(`Failed to load custom validation adapter: ${(error as Error).message}`);
      return new DefaultValidationAdapter();
    }
  }

  // Use built-in adapters
  switch (library) {
    case 'zod':
      return new ZodValidationAdapter();
    case 'class-validator':
      return new ClassValidatorAdapter();
    default:
      console.warn(`Unknown validation library: ${library}, using no validation`);
      return new DefaultValidationAdapter();
  }
}
