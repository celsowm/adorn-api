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
    Body,
    Params,
    Query,
    Schema,
} from '../../src/index.js';

// --- Schemas ---

const TaskSchema = z.object({
    id: z.string(),
    title: z.string().min(3),
    description: z.string().optional(),
    completed: z.boolean().default(false),
});

type Task = z.infer<typeof TaskSchema>;

const CreateTaskSchema = TaskSchema.omit({ id: true });
type CreateTaskDto = z.infer<typeof CreateTaskSchema>;

const UpdateTaskSchema = TaskSchema.partial().omit({ id: true });
type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;

const IdParamsSchema = z.object({
    id: z.string(),
});
type IdParams = z.infer<typeof IdParamsSchema>;

const PaginationSchema = z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10),
});
type Pagination = z.infer<typeof PaginationSchema>;

// --- In-memory store ---

let tasks: Task[] = [];

// --- Controller with NEW decorators ---

@Controller('/tasks')
class TaskController {
    @Get()
    @Query(PaginationSchema)
    getAll(query: Pagination): { data: Task[]; page: number; limit: number } {
        const start = (query.page - 1) * query.limit;
        const end = start + query.limit;
        return {
            data: tasks.slice(start, end),
            page: query.page,
            limit: query.limit,
        };
    }

    @Get('/:id')
    @Params(IdParamsSchema)
    getById(params: IdParams): Task | { error: string } {
        const task = tasks.find((t) => t.id === params.id);
        return task || { error: 'Task not found' };
    }

    @Post()
    @Body(CreateTaskSchema)
    create(body: CreateTaskDto): Task {
        const task: Task = {
            id: String(tasks.length + 1),
            title: body.title,
            description: body.description,
            completed: body.completed ?? false,
        };
        tasks.push(task);
        return task;
    }

    @Put('/:id')
    @Schema({
        params: IdParamsSchema,
        body: UpdateTaskSchema,
    })
    update(input: { params: IdParams; body: UpdateTaskDto }): Task | { error: string } {
        const index = tasks.findIndex((t) => t.id === input.params.id);
        if (index > -1) {
            tasks[index] = { ...tasks[index], ...input.body };
            return tasks[index];
        }
        return { error: 'Task not found' };
    }

    @Delete('/:id')
    @Params(IdParamsSchema)
    delete(params: IdParams): { success: boolean } | { error: string } {
        const index = tasks.findIndex((t) => t.id === params.id);
        if (index > -1) {
            tasks.splice(index, 1);
            return { success: true };
        }
        return { error: 'Task not found' };
    }
}

// --- Alternative: Using inline schemas in route options ---

@Controller('/tasks-v2')
class TaskControllerV2 {
    @Get('/:id', { params: IdParamsSchema })
    getById(params: IdParams): Task | { error: string } {
        const task = tasks.find((t) => t.id === params.id);
        return task || { error: 'Task not found' };
    }

    @Post('', { body: CreateTaskSchema })
    create(body: CreateTaskDto): Task {
        const task: Task = {
            id: String(tasks.length + 1),
            title: body.title,
            description: body.description,
            completed: body.completed ?? false,
        };
        tasks.push(task);
        return task;
    }

    @Put('/:id', {
        params: IdParamsSchema,
        body: UpdateTaskSchema,
    })
    update(params: IdParams, body: UpdateTaskDto): Task | { error: string } {
        const index = tasks.findIndex((t) => t.id === params.id);
        if (index > -1) {
            tasks[index] = { ...tasks[index], ...body };
            return tasks[index];
        }
        return { error: 'Task not found' };
    }
}

// --- Test Suite ---

describe('Integration: Typed CRUD with New Decorators', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        tasks = [{ id: '1', title: 'Initial Task', completed: false }];
    });

    afterEach(() => {
        app = null as any;
    });

    describe('TaskController with @Body, @Params, @Query, @Schema decorators', () => {
        beforeEach(() => {
            const adapter = new ExpressAdapter(app);
            adapter.registerController(TaskController);
        });

        it('GET /tasks - should return paginated tasks', async () => {
            const res = await request(app).get('/tasks?page=1&limit=10');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.page).toBe(1);
            expect(res.body.limit).toBe(10);
        });

        it('GET /tasks - should use default pagination', async () => {
            const res = await request(app).get('/tasks');
            expect(res.status).toBe(200);
            expect(res.body.page).toBe(1);
            expect(res.body.limit).toBe(10);
        });

        it('GET /tasks/:id - should return task by id', async () => {
            const res = await request(app).get('/tasks/1');
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Initial Task');
        });

        it('GET /tasks/:id - should return error for non-existent task', async () => {
            const res = await request(app).get('/tasks/999');
            expect(res.status).toBe(200);
            expect(res.body.error).toBe('Task not found');
        });

        it('POST /tasks - should create task with valid data', async () => {
            const newTask = { title: 'New Task' };
            const res = await request(app).post('/tasks').send(newTask);

            expect(res.status).toBe(200);
            expect(res.body.id).toBeDefined();
            expect(res.body.title).toBe('New Task');
            expect(res.body.completed).toBe(false);
        });

        it('POST /tasks - should apply defaults from schema', async () => {
            const res = await request(app)
                .post('/tasks')
                .send({ title: 'Task with defaults' });

            expect(res.status).toBe(200);
            expect(res.body.completed).toBe(false);
        });

        it('POST /tasks - should fail validation for short title', async () => {
            const res = await request(app).post('/tasks').send({ title: 'No' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.errors).toBeDefined();
        });

        it('PUT /tasks/:id - should update task with Schema decorator', async () => {
            const updateData: UpdateTaskDto = { completed: true };
            const res = await request(app).put('/tasks/1').send(updateData);

            expect(res.status).toBe(200);
            expect(res.body.completed).toBe(true);
            expect(res.body.title).toBe('Initial Task');
        });

        it('PUT /tasks/:id - should return error for non-existent task', async () => {
            const res = await request(app)
                .put('/tasks/999')
                .send({ completed: true });

            expect(res.status).toBe(200);
            expect(res.body.error).toBe('Task not found');
        });

        it('DELETE /tasks/:id - should delete task', async () => {
            const res = await request(app).delete('/tasks/1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(tasks).toHaveLength(0);
        });

        it('DELETE /tasks/:id - should return error for non-existent task', async () => {
            const res = await request(app).delete('/tasks/999');

            expect(res.status).toBe(200);
            expect(res.body.error).toBe('Task not found');
        });
    });

    describe('TaskControllerV2 with inline schemas in route options', () => {
        beforeEach(() => {
            const adapter = new ExpressAdapter(app);
            adapter.registerController(TaskControllerV2);
        });

        it('GET /tasks-v2/:id - should work with inline paramsSchema', async () => {
            const res = await request(app).get('/tasks-v2/1');
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Initial Task');
        });

        it('POST /tasks-v2 - should work with inline bodySchema', async () => {
            const res = await request(app)
                .post('/tasks-v2')
                .send({ title: 'Inline Schema Task' });

            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Inline Schema Task');
        });

        it('PUT /tasks-v2/:id - should work with both inline schemas', async () => {
            const res = await request(app)
                .put('/tasks-v2/1')
                .send({ title: 'Updated Title' });

            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Updated Title');
        });
    });
});

describe('Integration: Full CRUD Flow', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        tasks = [{ id: '1', title: 'Initial Task', completed: false }];

        const adapter = new ExpressAdapter(app);
        adapter.registerController(TaskController);
    });

    it('should perform complete CRUD lifecycle', async () => {
        // 1. List all tasks
        let res = await request(app).get('/tasks');
        expect(res.body.data).toHaveLength(1);

        // 2. Create new task
        res = await request(app)
            .post('/tasks')
            .send({ title: 'Second Task', description: 'A description' });
        expect(res.body.id).toBe('2');
        const newTaskId = res.body.id;

        // 3. Verify creation
        res = await request(app).get('/tasks');
        expect(res.body.data).toHaveLength(2);

        // 4. Get by ID
        res = await request(app).get(`/tasks/${newTaskId}`);
        expect(res.body.title).toBe('Second Task');
        expect(res.body.description).toBe('A description');

        // 5. Update
        res = await request(app)
            .put(`/tasks/${newTaskId}`)
            .send({ completed: true, title: 'Updated Second Task' });
        expect(res.body.completed).toBe(true);
        expect(res.body.title).toBe('Updated Second Task');

        // 6. Delete
        res = await request(app).delete(`/tasks/${newTaskId}`);
        expect(res.body.success).toBe(true);

        // 7. Verify deletion
        res = await request(app).get('/tasks');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe('1');
    });
});
