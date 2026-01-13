import { z } from 'zod';
import { metadataStorage } from '../metadata/metadata-storage.js';
import { createZodValidationMiddleware } from '../validation/zod-adapter.js';

/**
 * Validates request body against a Zod schema and injects validated data
 * 
 * @example
 * ```ts
 * const CreateUserSchema = z.object({ name: z.string(), email: z.string().email() });
 * 
 * @Post()
 * @Body(CreateUserSchema)
 * createUser(body: z.infer<typeof CreateUserSchema>) {
 *   return { id: 1, ...body };
 * }
 * ```
 */
export function Body<T extends z.ZodType<any>>(schema: T) {
    return function (
        target: Function,
        context: ClassMethodDecoratorContext
    ): void {
        if (context.kind !== 'method') return;

        // Add validation middleware
        metadataStorage.addPendingMiddleware(
            target,
            createZodValidationMiddleware('body', schema)
        );

        // Register parameter for injection
        metadataStorage.addPendingParameter(target, {
            name: 'body',
            type: 'body',
            schema,
        });
    };
}

/**
 * Validates route params against a Zod schema and injects validated data
 * 
 * @example
 * ```ts
 * const IdParamsSchema = z.object({ id: z.string().uuid() });
 * 
 * @Get('/:id')
 * @Params(IdParamsSchema)
 * getById(params: z.infer<typeof IdParamsSchema>) {
 *   return { id: params.id };
 * }
 * ```
 */
export function Params<T extends z.ZodType<any>>(schema: T) {
    return function (
        target: Function,
        context: ClassMethodDecoratorContext
    ): void {
        if (context.kind !== 'method') return;

        metadataStorage.addPendingMiddleware(
            target,
            createZodValidationMiddleware('params', schema)
        );

        metadataStorage.addPendingParameter(target, {
            name: 'params',
            type: 'params',
            schema,
        });
    };
}

/**
 * Validates query parameters against a Zod schema and injects validated data
 * 
 * @example
 * ```ts
 * const PaginationSchema = z.object({ 
 *   page: z.coerce.number().default(1),
 *   limit: z.coerce.number().default(10)
 * });
 * 
 * @Get()
 * @Query(PaginationSchema)
 * list(query: z.infer<typeof PaginationSchema>) {
 *   return { page: query.page, limit: query.limit };
 * }
 * ```
 */
export function Query<T extends z.ZodType<any>>(schema: T) {
    return function (
        target: Function,
        context: ClassMethodDecoratorContext
    ): void {
        if (context.kind !== 'method') return;

        metadataStorage.addPendingMiddleware(
            target,
            createZodValidationMiddleware('query', schema)
        );

        metadataStorage.addPendingParameter(target, {
            name: 'query',
            type: 'query',
            schema,
        });
    };
}

/**
 * Configuration for the Schema decorator
 */
export interface SchemaOptions<
    P extends z.ZodType<any> = z.ZodType<any>,
    B extends z.ZodType<any> = z.ZodType<any>,
    Q extends z.ZodType<any> = z.ZodType<any>
> {
    params?: P;
    body?: B;
    query?: Q;
}

/**
 * Combined schema decorator - validates multiple sources and injects as single object
 * 
 * @example
 * ```ts
 * @Put('/:id')
 * @Schema({ 
 *   params: z.object({ id: z.string() }),
 *   body: z.object({ name: z.string() })
 * })
 * update(input: { params: { id: string }, body: { name: string } }) {
 *   return { id: input.params.id, name: input.body.name };
 * }
 * ```
 */
export function Schema<
    P extends z.ZodType<any>,
    B extends z.ZodType<any>,
    Q extends z.ZodType<any>
>(options: SchemaOptions<P, B, Q>) {
    return function (
        target: Function,
        context: ClassMethodDecoratorContext
    ): void {
        if (context.kind !== 'method') return;

        // Add validation middlewares for each schema
        if (options.params) {
            metadataStorage.addPendingMiddleware(
                target,
                createZodValidationMiddleware('params', options.params)
            );
        }

        if (options.body) {
            metadataStorage.addPendingMiddleware(
                target,
                createZodValidationMiddleware('body', options.body)
            );
        }

        if (options.query) {
            metadataStorage.addPendingMiddleware(
                target,
                createZodValidationMiddleware('query', options.query)
            );
        }

        // Register combined parameter
        metadataStorage.addPendingParameter(target, {
            name: 'input',
            type: 'combined',
            schema: options,
        });
    };
}

/**
 * Type helper for Schema decorator input
 */
export type SchemaInput<T extends SchemaOptions> = {
    params: T['params'] extends z.ZodType<any> ? z.infer<T['params']> : undefined;
    body: T['body'] extends z.ZodType<any> ? z.infer<T['body']> : undefined;
    query: T['query'] extends z.ZodType<any> ? z.infer<T['query']> : undefined;
};
