/**
 * Zod validation adapter for adorn-api
 * 
 * This adapter provides runtime validation using Zod schemas.
 * It transforms TypeScript DTO classes into Zod schemas for runtime safety.
 */

import { z, type ZodTypeAny } from 'zod';
import type { ValidationAdapter, ValidationSchema, ValidationResult } from './types.js';

// Symbol to identify Zod schemas
const ZOD_SCHEMA_SYMBOL = Symbol('zod-schema');

/**
 * Represents a Zod validation schema
 */
export interface ZodValidationSchema extends ValidationSchema {
  [ZOD_SCHEMA_SYMBOL]: ZodTypeAny;
  name?: string;
}

/**
 * Map to cache generated schemas for DTO classes
 */
const schemaCache = new Map<Function, ZodValidationSchema>();

/**
 * Create a Zod schema from a DTO class constructor
 * 
 * Uses runtime instance inspection to build schemas from DTO classes.
 */
export function createZodSchema<T extends object>(dtoClass: new () => T): ZodValidationSchema {
  if (!dtoClass) {
    throw new Error('createZodSchema: dtoClass is undefined');
  }
  // Check cache first
  if (schemaCache.has(dtoClass)) {
    return schemaCache.get(dtoClass)!;
  }

  const schema = buildFallbackSchema(dtoClass);
  
  const validationSchema: ZodValidationSchema = {
    [ZOD_SCHEMA_SYMBOL]: schema,
    name: dtoClass.name || 'AnonymousDto',
  };

  // Cache the schema
  schemaCache.set(dtoClass, validationSchema);

  return validationSchema;
}

/**
 * Build a schema by inspecting a DTO instance
 */
function buildFallbackSchema<T extends object>(dtoClass: new () => T): ZodTypeAny {
  // Create an instance to get property keys
  let instance: T;
  try {
    instance = new dtoClass();
  } catch {
    // If we can't instantiate, use generic object
    return z.record(z.unknown());
  }
  
  const shape: Record<string, ZodTypeAny> = {};
  
  for (const key of Object.keys(instance)) {
    const value = (instance as any)[key];
    
    if (typeof value === 'string') {
      shape[key] = z.preprocess((val) => String(val), z.string());
    } else if (typeof value === 'number') {
      shape[key] = z.preprocess((val) => {
        const parsed = Number(val);
        return isNaN(parsed) ? val : parsed;
      }, z.number());
    } else if (typeof value === 'boolean') {
      shape[key] = z.preprocess((val) => {
        if (typeof val === 'string') {
          if (val.toLowerCase() === 'true') return true;
          if (val.toLowerCase() === 'false') return false;
        }
        return val;
      }, z.boolean());
    } else if (value instanceof Date) {
      shape[key] = z.preprocess((val) => {
        if (typeof val === 'string' || typeof val === 'number') {
          const date = new Date(val);
          return isNaN(date.getTime()) ? val : date;
        }
        return val;
      }, z.date());
    } else {
      shape[key] = z.unknown();
    }
  }
  
  return z.object(shape);
}

/**
 * Validate data against a Zod schema
 */
export function validateZod(schema: ValidationSchema, data: unknown): ValidationResult {
  const zodSchema = schema as ZodValidationSchema;
  const zodType = zodSchema[ZOD_SCHEMA_SYMBOL];
  
  if (!zodType) {
    return {
      success: false,
      errors: ['Invalid schema: missing Zod type'],
    };
  }
  
  const result = zodType.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data as Record<string, unknown>,
    };
  }
  
  const errors = result.error.errors.map(e => {
    const path = e.path.join('.');
    return `${path}: ${e.message}`;
  });
  
  return {
    success: false,
    errors,
  };
}

/**
 * Create a Zod validation adapter instance
 */
export const zodAdapter: ValidationAdapter = {
  createSchema: createZodSchema,
  validate: validateZod,
};

/**
 * Helper to create and validate in one step
 */
export function validateWithZod<T extends object>(
  dtoClass: new () => T,
  data: unknown
): ValidationResult {
  const schema = createZodSchema(dtoClass);
  return validateZod(schema, data);
}

/**
 * Express middleware for Zod validation
 * 
 * Usage:
 *   app.post('/users', validateBody(CreateUserDto), controller.createUser);
 */
export function validateBody<T extends object>(dtoClass: new () => T) {
  return function (req: any, _res: any, next: any) {
    const result = validateWithZod(dtoClass, req.body);
    
    if (!result.success) {
      req.validationErrors = result.errors;
    } else {
      req.validatedBody = result.data;
    }
    
    next();
  };
}

/**
 * Validate query parameters with Zod
 */
export function validateQuery<T extends object>(dtoClass: new () => T) {
  return function (req: any, _res: any, next: any) {
    const result = validateWithZod(dtoClass, req.query);
    
    if (!result.success) {
      req.validationErrors = result.errors;
    } else {
      req.validatedQuery = result.data;
    }
    
    next();
  };
}
