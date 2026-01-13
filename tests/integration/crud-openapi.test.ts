import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    ExpressAdapter,
    OpenApiGenerator,
    type HttpContext
} from '../../src/index.js';

describe('Integration: CRUD & OpenAPI', () => {
    let app: express.Application;
    let tasks: any[] = [];

    beforeEach(() => {
        app = express();
        app.use(express.json());
        tasks = [
            { id: '1', title: 'Task 1' },
            { id: '2', title: 'Task 2' }
        ];
    });

    afterEach(() => {
        app = null as any;
    });

    @Controller('/tasks')
    class TaskController {
        @Get()
        getAll() {
            return tasks;
        }

        @Get('/:id', { params: [{ name: 'id', type: 'param' }] })
        getById(id: string) {
            const task = tasks.find(t => t.id === id);
            return task || { error: 'Not found' };
        }

        @Post('', { params: [{ name: 'body', type: 'body' }] })
        create(body: any) {
            const task = { id: String(tasks.length + 1), ...body };
            tasks.push(task);
            return task;
        }

        @Put('/:id', { params: [{ name: 'id', type: 'param' }, { name: 'body', type: 'body' }] })
        update(id: string, body: any) {
            const index = tasks.findIndex(t => t.id === id);
            if (index > -1) {
                tasks[index] = { ...tasks[index], ...body };
                return tasks[index];
            }
            return { error: 'Not found' };
        }

        @Delete('/:id', { params: [{ name: 'id', type: 'param' }] })
        delete(id: string) {
            const index = tasks.findIndex(t => t.id === id);
            if (index > -1) {
                tasks.splice(index, 1);
                return { success: true };
            }
            return { error: 'Not found' };
        }
    }

    it('should perform all CRUD operations', async () => {
        const adapter = new ExpressAdapter(app);
        adapter.registerController(TaskController);

        // GET ALL
        const listRes = await request(app).get('/tasks');
        expect(listRes.status).toBe(200);
        expect(listRes.body).toHaveLength(2);

        // POST
        const createRes = await request(app).post('/tasks').send({ title: 'New Task' });
        expect(createRes.status).toBe(200);
        expect(createRes.body.title).toBe('New Task');
        expect(tasks).toHaveLength(3);

        // GET BY ID
        const getRes = await request(app).get(`/tasks/${createRes.body.id}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.title).toBe('New Task');

        // PUT
        const updateRes = await request(app).put(`/tasks/${createRes.body.id}`).send({ title: 'Updated Task' });
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.title).toBe('Updated Task');

        // DELETE
        const deleteRes = await request(app).delete(`/tasks/${createRes.body.id}`);
        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body.success).toBe(true);
        expect(tasks).toHaveLength(2);
    });

    it('should generate valid OpenAPI JSON schema', () => {
        const generator = new OpenApiGenerator();
        const spec = generator.generateDocument({
            info: {
                title: 'Task API',
                version: '1.0.0',
                description: 'A simple CRUD API for tasks'
            }
        });

        expect(spec.openapi).toBe('3.1.0');
        expect(spec.info.title).toBe('Task API');

        // Check paths
        expect(spec.paths).toBeDefined();
        const paths = spec.paths!;

        expect(paths).toHaveProperty('/tasks');
        expect(paths).toHaveProperty('/tasks/{id}');

        // Check methods for /tasks
        expect(paths['/tasks']).toHaveProperty('get');
        expect(paths['/tasks']).toHaveProperty('post');

        // Check methods for /tasks/{id}
        expect(paths['/tasks/{id}']).toHaveProperty('get');
        expect(paths['/tasks/{id}']).toHaveProperty('put');
        expect(paths['/tasks/{id}']).toHaveProperty('delete');

        // Check parameters for /tasks/{id}
        const getOperation = (paths['/tasks/{id}'] as any).get;
        expect(getOperation).toBeDefined();
        const getByIdParams = getOperation.parameters;
        expect(getByIdParams).toBeDefined();
        const firstParam = getByIdParams![0] as any;
        expect(firstParam.name).toBe('id');
        expect(firstParam.in).toBe('param');
    });
});
