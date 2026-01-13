import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
    Controller,
    Post,
    Get,
    ExpressAdapter,
    ValidateBody,
    ValidateParams,
    zValidator,
    type HttpContext
} from '../../src/index.js';

describe('Integration: DTO Validation', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    afterEach(() => {
        app = null as any;
    });

    const CreateUserSchema = z.object({
        username: z.string().min(3),
        email: z.string().email(),
        age: z.number().optional(),
    });

    it('should pass validation when body is valid', async () => {
        @Controller('/users')
        class UserController {
            @Post('/')
            @ValidateBody(zValidator(CreateUserSchema))
            create(ctx: HttpContext) {
                return { success: true, data: ctx.req.body };
            }
        }

        const adapter = new ExpressAdapter(app);
        adapter.registerController(UserController);

        const validUser = {
            username: 'johndoe',
            email: 'john@example.com',
            age: 30,
        };

        const response = await request(app).post('/users').send(validUser);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(validUser);
    });

    it('should return 400 when body is invalid', async () => {
        @Controller('/users')
        class UserController {
            @Post('/')
            @ValidateBody(zValidator(CreateUserSchema))
            create() {
                return { success: true };
            }
        }

        const adapter = new ExpressAdapter(app);
        adapter.registerController(UserController);

        const invalidUser = {
            username: 'jo', // too short
            email: 'invalid-email',
        };

        const response = await request(app).post('/users').send(invalidUser);

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors).toContain('username: String must contain at least 3 character(s)');
        expect(response.body.errors).toContain('email: Invalid email');
    });

    it('should validate URL parameters', async () => {
        const ParamsSchema = z.object({
            id: z.string().regex(/^\d+$/, 'ID must be numeric'),
        });

        @Controller('/items')
        class ItemController {
            @Get('/:id')
            @ValidateParams(zValidator(ParamsSchema))
            getById(ctx: HttpContext) {
                return { id: ctx.params.param('id') };
            }
        }

        const adapter = new ExpressAdapter(app);
        adapter.registerController(ItemController);

        // Valid param
        const validResponse = await request(app).get('/items/123');
        expect(validResponse.status).toBe(200);
        expect(validResponse.body.id).toBe('123');

        // Invalid param
        const invalidResponse = await request(app).get('/items/abc');
        expect(invalidResponse.status).toBe(400);
        expect(invalidResponse.body.errors).toContain('id: ID must be numeric');
    });

    it('should handle nested objects in validation', async () => {
        const NestedSchema = z.object({
            profile: z.object({
                firstName: z.string(),
                lastName: z.string(),
            }),
            roles: z.array(z.string()),
        });

        @Controller('/nested')
        class NestedController {
            @Post('/')
            @ValidateBody(zValidator(NestedSchema))
            handle(ctx: HttpContext) {
                return ctx.req.body;
            }
        }

        const adapter = new ExpressAdapter(app);
        adapter.registerController(NestedController);

        const invalidNested = {
            profile: {
                firstName: 'John',
                // lastName missing
            },
            roles: [123], // should be strings
        };

        const response = await request(app).post('/nested').send(invalidNested);

        expect(response.status).toBe(400);
        expect(response.body.errors).toContain('profile.lastName: Required');
        expect(response.body.errors).toContain('roles.0: Expected string, received number');
    });
});
