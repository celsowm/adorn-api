import { z } from 'zod';
import { ValidationSchema } from '../decorators/validation.decorator.js';

/**
 * Adapter to use Zod schemas with Adorn-API validation decorators.
 */
export class ZodSchemaAdapter implements ValidationSchema {
    constructor(private schema: z.ZodType<any>) { }

    async validate(value: any): Promise<boolean> {
        const result = await this.schema.safeParseAsync(value);
        return result.success;
    }

    async getErrors(value: any): Promise<string[]> {
        const result = await this.schema.safeParseAsync(value);
        if (result.success) return [];
        return result.error.errors.map((err) => {
            const path = err.path.join('.');
            return path ? `${path}: ${err.message}` : err.message;
        });
    }
}

/**
 * Creates a ValidationSchema from a Zod schema.
 * @param schema The Zod schema to use for validation
 * @returns A ValidationSchema compatible with Adorn-API decorators
 */
export function zValidator(schema: z.ZodType<any>): ValidationSchema {
    return new ZodSchemaAdapter(schema);
}
