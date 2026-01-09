import {
  Contract,
  Controller,
  Get,
  Post,
  Response
} from '../../core/decorators/index.js';
import type { HttpContext } from '../../http/context.js';
import { HttpError } from '../../http/errors.js';
import { registerContract } from '../../contracts/builder.js';

type Todo = {
  id: number;
  title: string;
  done: boolean;
};

type CreateTodoInput = {
  title: string;
};

const todoSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    done: { type: 'boolean' }
  },
  required: ['id', 'title', 'done']
};

const createTodoSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' }
  },
  required: ['title']
};

export const ListTodosContract = registerContract('ListTodos', {
  mode: 'list',
  schemas: {
    output: { type: 'array', items: todoSchema }
  }
});

export const GetTodoContract = registerContract<{ id: number }, Todo, Todo>('GetTodo', {
  mode: 'single',
  schemas: {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' }
      }
    ],
    output: todoSchema
  }
});

export const CreateTodoContract = registerContract<CreateTodoInput, Todo, Todo>('CreateTodo', {
  mode: 'single',
  schemas: {
    input: createTodoSchema,
    output: todoSchema
  }
});

const todos: Todo[] = [
  { id: 1, title: 'Read the docs', done: false },
  { id: 2, title: 'Ship the feature', done: true }
];
let nextId = 3;

const toNumber = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

@Controller({ path: '/todos', tags: ['Todos'] })
export class TodosController {
  @Get('/')
  @Contract(ListTodosContract)
  async list(): Promise<Todo[]> {
    return todos;
  }

  @Get('/:id')
  @Response(404, 'Not Found')
  @Contract(GetTodoContract)
  async getById(ctx: HttpContext): Promise<Todo> {
    const id = toNumber(ctx.params.id);
    const todo = todos.find(entry => entry.id === id);
    if (!todo) {
      throw new HttpError(404, 'Todo not found');
    }
    return todo;
  }

  @Post('/')
  @Response(400, 'Validation error')
  @Contract(CreateTodoContract)
  async create(ctx: HttpContext): Promise<Todo> {
    const input = ctx.body as CreateTodoInput;
    const todo: Todo = { id: nextId++, title: input.title, done: false };
    todos.push(todo);
    return todo;
  }
}
