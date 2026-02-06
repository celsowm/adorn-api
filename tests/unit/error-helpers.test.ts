import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
    Controller,
    Get,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    internalServerError,
    conflict,
    unprocessableEntity,
    tooManyRequests,
    serviceUnavailable,
    createExpressApp
} from '../../src/index';

describe('HttpError Helpers', () => {
    it('should handle badRequest()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/400')
            handle400() {
                badRequest('Custom bad request');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/400');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Custom bad request');
    });

    it('should handle unauthorized()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/401')
            handle401() {
                unauthorized('Custom unauthorized');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/401');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Custom unauthorized');
    });

    it('should handle forbidden()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/403')
            handle403() {
                forbidden();
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/403');
        expect(res.status).toBe(403);
    });

    it('should handle notFound()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/404')
            handle404() {
                notFound('Resource not found');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/404');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Resource not found');
    });

    it('should handle internalServerError()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/500')
            handle500() {
                internalServerError('Crash');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/500');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Crash');
    });

    it('should handle conflict()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/409')
            handle409() {
                conflict('Already exists');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/409');
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Already exists');
    });

    it('should handle unprocessableEntity()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/422')
            handle422() {
                unprocessableEntity('Semantic error');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/422');
        expect(res.status).toBe(422);
        expect(res.body.message).toBe('Semantic error');
    });

    it('should handle tooManyRequests()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/429')
            handle429() {
                tooManyRequests('Slow down');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/429');
        expect(res.status).toBe(429);
        expect(res.body.message).toBe('Slow down');
    });

    it('should handle serviceUnavailable()', async () => {
        @Controller('/errors')
        class ErrorController {
            @Get('/503')
            handle503() {
                serviceUnavailable('Down for maintenance');
            }
        }
        const app = await createExpressApp({ controllers: [ErrorController] });
        const res = await request(app).get('/errors/503');
        expect(res.status).toBe(503);
        expect(res.body.message).toBe('Down for maintenance');
    });
});
