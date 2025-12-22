// src/lib/adapters.ts
// Runtime adapters for auth, middleware injection, and DTO factories
/**
 * Default auth adapter that imports from configured path
 */
export class DefaultAuthAdapter {
    authMiddlewarePath;
    constructor(authMiddlewarePath) {
        this.authMiddlewarePath = authMiddlewarePath;
    }
    getMiddleware(role) {
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
 * Default error adapter - passes errors through unchanged
 */
export class DefaultErrorAdapter {
    handleError(err) {
        return err;
    }
}
/**
 * DTO factory that instantiates classes
 * Enables defaults and class methods to work
 */
export class ClassInstantiatingDTOFactory {
    instantiate(DTOClass, data) {
        const instance = new DTOClass();
        // Merge data into the instance
        Object.assign(instance, data);
        return instance;
    }
}
/**
 * Default validation adapter - no validation (passes through)
 * Used when validation is not enabled
 */
export class DefaultValidationAdapter {
    async validate(_dto, _DTOClass) {
        // No validation - pass through
    }
}
/**
 * Zod validation adapter
 * Validates DTOs using Zod schemas
 * Assumes DTO classes have a static `schema` property with a Zod schema
 */
export class ZodValidationAdapter {
    async validate(dto, DTOClass) {
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
        }
        catch (error) {
            if (error && typeof error === 'object' && 'issues' in error) {
                // Zod validation error - format nicely
                const issues = error.issues;
                const messages = issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
                const validationError = new Error(`Validation failed: ${messages}`);
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
export class ClassValidatorAdapter {
    async validate(dto, DTOClass) {
        if (!DTOClass) {
            throw new Error('DTOClass is required for class-validator validation');
        }
        try {
            // Dynamic import of class-validator (optional dependency)
            // @ts-ignore - class-validator is optional and may not be installed
            const classValidatorModule = await import('class-validator');
            const validate = classValidatorModule.validate || classValidatorModule.default?.validate;
            if (typeof validate !== 'function') {
                throw new Error('class-validator module must export a validate function');
            }
            const errors = await validate(dto);
            if (errors.length > 0) {
                const messages = errors.map((err) => {
                    const constraints = Object.values(err.constraints || {}).join(', ');
                    return `${err.property}: ${constraints}`;
                }).join('; ');
                const validationError = new Error(`Validation failed: ${messages}`);
                validationError.statusCode = 400;
                validationError.name = 'ValidationError';
                validationError.details = errors;
                throw validationError;
            }
        }
        catch (error) {
            if (error.name === 'ValidationError') {
                throw error;
            }
            throw new Error(`Validation error: ${error.message}`);
        }
    }
}
/**
 * Factory function to create validation adapter based on config
 */
export function createValidationAdapter(config) {
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
        }
        catch (error) {
            console.warn(`Failed to load custom validation adapter: ${error.message}`);
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
