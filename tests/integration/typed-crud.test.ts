import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    ExpressAdapter,
    zValidator,
    ValidateBody,
    ValidateParams,
} from '../../src/index.js';

// --- Typed DTOs and Schemas ---

const TaskSchema = z.object({
    id: z.string(),
    title: z.string().min(3),
    description: z.string().optional(),
    completed: z.boolean().default(false),
});

type Task = z.infer<typeof TaskSchema>;

const CreateTaskSchema = TaskSchema.omit({ id: true });
type CreateTaskDto = z.input<typeof CreateTaskSchema>;

const UpdateTaskSchema = TaskSchema.partial().omit({ id: true });
type UpdateTaskDto = z.input<typeof UpdateTaskSchema>;

const ParamsWithIdSchema = z.object({
    id: z.string(),
});
type ParamsWithId = z.infer<typeof ParamsWithIdSchema>;

// --- Controller Implementation ---

let tasks: Task[] = [];

@Controller('/tasks')
class TaskController {
    @Get()
    getAll(): Task[] {
        return tasks;
    }

    @Get('/:id', { params: [{ name: 'id', type: 'param' }] })
    @ValidateParams(zValidator(ParamsWithIdSchema))
    getById(id: string): Task | { error: string } {
        const task = tasks.find(t => t.id === id);
        return task || { error: 'Task not found' };
    }

    @Post('', { params: [{ name: 'body', type: 'body' }] })
    @ValidateBody(zValidator(CreateTaskSchema))
    create(body: CreateTaskDto): Task {
        const task: Task = {
            id: String(tasks.length + 1),
            ...body,
            completed: body.completed ?? false,
        };
        tasks.push(task);
        return task;
    }

    @Put('/:id', { params: [{ name: 'id', type: 'param' }, { name: 'body', type: 'body' }] })
    @ValidateParams(zValidator(ParamsWithIdSchema))
    @ValidateBody(zValidator(UpdateTaskSchema))
    update(id: string, body: UpdateTaskDto): Task | { error: string } {
        const index = tasks.findIndex(t => t.id === id);
        if (index > -1) {
            tasks[index] = { ...tasks[index], ...body };
            return tasks[index];
        }
        return { error: 'Task not found' };
    }

    @Delete('/:id', { params: [{ name: 'id', type: 'param' }] })
    @ValidateParams(zValidator(ParamsWithIdSchema))
    delete(id: string): { success: boolean } | { error: string } {
        const index = tasks.findIndex(t => t.id === id);
        if (index > -1) {
            tasks.splice(index, 1);
            return { success: true };
        }
        return { error: 'Task not found' };
    }
}

// --- Test Suite ---

describe('Integration: Totally Typed CRUD', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        tasks = [
            { id: '1', title: 'Initial Task', completed: false },
        ];
    });

    afterEach(() => {
        app = null as any;
    });

    it('should perform all CRUD operations with type safety and validation', async () => {
        const adapter = new ExpressAdapter(app);
        adapter.registerController(TaskController);

        // 1. GET ALL
        const listRes = await request(app).get('/tasks');
        expect(listRes.status).toBe(200);
        expect(listRes.body).toHaveLength(1);
        expect(listRes.body[0].title).toBe('Initial Task');

        // 2. POST (Valid)
        const newTask: CreateTaskDto = { title: 'New Typed Task' };
        const createRes = await request(app).post('/tasks').send(newTask);
        expect(createRes.status).toBe(200);
        expect(createRes.body.id).toBeDefined();
        expect(createRes.body.title).toBe('New Typed Task');

        // 3. POST (Invalid - Trigger Validation)
        const invalidTask = { title: 'No' }; // Too short (min 3)
        const invalidRes = await request(app).post('/tasks').send(invalidTask);
        expect(invalidRes.status).toBe(400);
        expect(invalidRes.body.errors).toBeDefined();

        // 4. GET BY ID
        const taskId = createRes.body.id;
        const getRes = await request(app).get(`/tasks/${taskId}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.title).toBe('New Typed Task');

        // 5. PUT (Valid)
        const updateData: UpdateTaskDto = { completed: true };
        const updateRes = await request(app).put(`/tasks/${taskId}`).send(updateData);
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.completed).toBe(true);
        expect(updateRes.body.title).toBe('New Typed Task');

        // 6. DELETE
        const deleteRes = await request(app).delete(`/tasks/${taskId}`);
        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body.success).toBe(true);

        const finalCheck = await request(app).get('/tasks');
        expect(finalCheck.body).toHaveLength(1);
    });
});
