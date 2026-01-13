import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

/**
 * Format Zod errors into readable strings
 */
export function formatZodErrors(error: z.ZodError): string[] {
    return error.errors.map((err) => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
    });
}

/**
 * Create an Express middleware that validates a specific request property using Zod
 */
export function createZodValidationMiddleware(
    source: 'params' | 'body' | 'query',
    schema: z.ZodType<any>
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const data = getRequestData(req, source);
        const result = await schema.safeParseAsync(data);

        if (!result.success) {
            res.status(400).json({
                error: 'Validation failed',
                source,
                errors: formatZodErrors(result.error),
            });
            return;
        }

        // Replace with validated/transformed data
        setRequestData(req, source, result.data);
        return next();
    };
}

/**
 * Get data from request based on source
 */
function getRequestData(req: Request, source: 'params' | 'body' | 'query'): any {
    switch (source) {
        case 'params':
            return req.params;
        case 'body':
            return req.body;
        case 'query':
            return req.query;
        default:
            return undefined;
    }
}

/**
 * Set validated data back to request
 */
function setRequestData(
    req: Request,
    source: 'params' | 'body' | 'query',
    data: any
): void {
    switch (source) {
        case 'params':
            req.params = data;
            break;
        case 'body':
            req.body = data;
            break;
        case 'query':
            (req as any).query = data;
            break;
    }
}

/**
 * Type helper for inferring schema types
 */
export type InferSchema<T> = T extends z.ZodType<infer U> ? U : never;
