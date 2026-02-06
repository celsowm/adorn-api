import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
    Controller,
    Get,
    Post,
    Returns,
    ok,
    noContent,
    created,
    accepted,
    redirect,
    createExpressApp,
    Dto,
    Field,
    t
} from '../../src/index';

@Dto()
class TaskDto {
    @Field(t.string())
    name!: string;

    @Field(t.string({ format: 'byte' }))
    data!: Buffer;
}

describe('HttpResponse Wrappers', () => {
    it('should return 204 with noContent()', async () => {
        @Controller('/test')
        class TestController {
            @Get('/204')
            @Returns({ status: 204 })
            async handle204() {
                return noContent();
            }
        }

        const app = await createExpressApp({ controllers: [TestController] });
        const res = await request(app).get('/test/204');
        expect(res.status).toBe(204);
        expect(res.body).toEqual({});
    });

    it('should return 200 with ok() and apply schema transformations', async () => {
        @Controller('/test')
        class TestController {
            @Get('/200')
            @Returns(TaskDto)
            async handle200() {
                return ok({
                    name: 'Test Task',
                    data: Buffer.from('hello'),
                    extra: 'preserved' // Adorn currently preserves extra fields
                });
            }
        }

        const app = await createExpressApp({ controllers: [TestController] });
        const res = await request(app).get('/test/200');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Test Task');
        expect(res.body.data).toBe(Buffer.from('hello').toString('base64'));
        expect(res.body.extra).toBe('preserved');
    });

    it('should return 201 with created()', async () => {
        @Controller('/test')
        class TestController {
            @Post('/201')
            @Returns({ status: 201, schema: TaskDto })
            async handle201() {
                return created({ name: 'New Task', data: Buffer.from('new') });
            }
        }

        const app = await createExpressApp({ controllers: [TestController] });
        const res = await request(app).post('/test/201');
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('New Task');
        expect(res.body.data).toBe(Buffer.from('new').toString('base64'));
    });

    it('should return 202 with accepted()', async () => {
        @Controller('/test')
        class TestController {
            @Post('/202')
            @Returns({ status: 202 })
            async handle202() {
                return accepted({ status: 'processing' });
            }
        }

        const app = await createExpressApp({ controllers: [TestController] });
        const res = await request(app).post('/test/202');
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ status: 'processing' });
    });

    it('should handle dynamic status based on logic', async () => {
        @Controller('/test')
        class TestController {
            @Get('/dynamic/:id')
            @Returns({ status: 200, schema: TaskDto })
            @Returns({ status: 204 })
            async handleDynamic(ctx: any) {
                if (ctx.params.id === '1') {
                    return ok({ name: 'Found Task', data: Buffer.from('found') });
                }
                return noContent();
            }
        }

        const app = await createExpressApp({ controllers: [TestController] });

        const res1 = await request(app).get('/test/dynamic/1');
        expect(res1.status).toBe(200);
        expect(res1.body.name).toBe('Found Task');
        expect(res1.body.data).toBe(Buffer.from('found').toString('base64'));

        const res2 = await request(app).get('/test/dynamic/2');
        expect(res2.status).toBe(204);
        expect(res2.body).toEqual({});
    });

    it('should handle redirect()', async () => {
        @Controller('/test')
        class TestController {
            @Get('/redirect')
            async handleRedirect() {
                return redirect('https://example.com');
            }
        }

        const app = await createExpressApp({ controllers: [TestController] });
        const res = await request(app).get('/test/redirect');
        expect(res.status).toBe(302);
        expect(res.header.location).toBe('https://example.com');
    });
});
