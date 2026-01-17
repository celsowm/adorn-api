import {
  Body,
  Controller,
  Delete,
  Dto,
  Errors,
  Field,
  Get,
  HttpError,
  OmitDto,
  Params,
  Patch,
  PartialDto,
  PickDto,
  Post,
  Put,
  Query,
  Returns,
  createExpressApp,
  t,
  type RequestContext
} from "../../src";

type TaskRecord = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
};

let nextId = 1;
const tasks: TaskRecord[] = [
  {
    id: nextId++,
    title: "Sketch the REST surface",
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: nextId++,
    title: "Ship the first version",
    completed: true,
    createdAt: new Date().toISOString()
  }
];

@Dto({ description: "Task returned by the API." })
class TaskDto {
  @Field(t.integer({ description: "Task identifier." }))
  id!: number;

  @Field(t.string({ minLength: 1 }))
  title!: string;

  @Field(t.boolean())
  completed!: boolean;

  @Field(t.dateTime({ description: "Creation timestamp." }))
  createdAt!: string;
}

interface CreateTaskDto extends Omit<TaskDto, "id" | "createdAt" | "completed"> {
  completed?: boolean;
}

@OmitDto(TaskDto, ["id", "createdAt"], {
  overrides: {
    completed: { optional: true }
  }
})
class CreateTaskDto {}

interface ReplaceTaskDto extends Omit<TaskDto, "id" | "createdAt"> {}

@OmitDto(TaskDto, ["id", "createdAt"])
class ReplaceTaskDto {}

interface UpdateTaskDto extends Partial<ReplaceTaskDto> {}

@PartialDto(ReplaceTaskDto)
class UpdateTaskDto {}

interface TaskParamsDto extends Pick<TaskDto, "id"> {}

@PickDto(TaskDto, ["id"])
class TaskParamsDto {}

@Dto()
class TaskQueryDto {
  @Field(t.optional(t.integer({ minimum: 0 })))
  offset?: number;

  @Field(t.optional(t.integer({ minimum: 1, maximum: 100 })))
  limit?: number;

  @Field(t.optional(t.boolean()))
  completed?: boolean;
}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

const TaskErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid id." },
  { status: 404, description: "Not found." }
]);

function normalizeSingle(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first === undefined || first === null) {
      return undefined;
    }
    return typeof first === "string" ? first : String(first);
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === "string" ? value : String(value);
}

function parseNumber(value: unknown): number | undefined {
  const text = normalizeSingle(value);
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseBoolean(value: unknown): boolean | undefined {
  const text = normalizeSingle(value);
  if (text === undefined) {
    return undefined;
  }
  if (text === "true" || text === "1") {
    return true;
  }
  if (text === "false" || text === "0") {
    return false;
  }
  return undefined;
}

function parseId(value: unknown): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined || !Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

@Controller("/tasks")
class TaskController {
  @Get("/")
  @Query(TaskQueryDto)
  @Returns(t.array(t.ref(TaskDto)))
  list(ctx: RequestContext<unknown, TaskQueryDto>) {
    const offset = Math.max(0, parseNumber(ctx.query?.offset) ?? 0);
    const limit = Math.min(100, Math.max(1, parseNumber(ctx.query?.limit) ?? 25));
    const completed = parseBoolean(ctx.query?.completed);

    let result = tasks;
    if (completed !== undefined) {
      result = result.filter((task) => task.completed === completed);
    }
    return result.slice(offset, offset + limit);
  }

  @Get("/:id")
  @Params(TaskParamsDto)
  @Returns(TaskDto)
  @TaskErrors
  getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseId(ctx.params.id);
    if (id === undefined) {
      throw new HttpError(400, "Invalid task id.");
    }
    const task = tasks.find((entry) => entry.id === id);
    if (!task) {
      throw new HttpError(404, "Task not found.");
    }
    return task;
  }

  @Post("/")
  @Body(CreateTaskDto)
  @Returns({ status: 201, schema: TaskDto, description: "Created." })
  create(ctx: RequestContext<CreateTaskDto>) {
    const task: TaskRecord = {
      id: nextId++,
      title: ctx.body.title,
      completed: ctx.body.completed ?? false,
      createdAt: new Date().toISOString()
    };
    tasks.push(task);
    return task;
  }

  @Put("/:id")
  @Params(TaskParamsDto)
  @Body(ReplaceTaskDto)
  @Returns(TaskDto)
  @TaskErrors
  replace(ctx: RequestContext<ReplaceTaskDto, undefined, { id: string }>) {
    const id = parseId(ctx.params.id);
    if (id === undefined) {
      throw new HttpError(400, "Invalid task id.");
    }
    const index = tasks.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new HttpError(404, "Task not found.");
    }
    const updated: TaskRecord = {
      id,
      title: ctx.body.title,
      completed: ctx.body.completed,
      createdAt: tasks[index].createdAt
    };
    tasks[index] = updated;
    return updated;
  }

  @Patch("/:id")
  @Params(TaskParamsDto)
  @Body(UpdateTaskDto)
  @Returns(TaskDto)
  @TaskErrors
  update(ctx: RequestContext<UpdateTaskDto, undefined, { id: string }>) {
    const id = parseId(ctx.params.id);
    if (id === undefined) {
      throw new HttpError(400, "Invalid task id.");
    }
    const task = tasks.find((entry) => entry.id === id);
    if (!task) {
      throw new HttpError(404, "Task not found.");
    }
    if (ctx.body.title !== undefined) {
      task.title = ctx.body.title;
    }
    if (ctx.body.completed !== undefined) {
      task.completed = ctx.body.completed;
    }
    return task;
  }

  @Delete("/:id")
  @Params(TaskParamsDto)
  @Returns({ status: 204, description: "Deleted." })
  @TaskErrors
  remove(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseId(ctx.params.id);
    if (id === undefined) {
      throw new HttpError(400, "Invalid task id.");
    }
    const index = tasks.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new HttpError(404, "Task not found.");
    }
    tasks.splice(index, 1);
  }
}

const app = createExpressApp({
  controllers: [TaskController],
  openApi: {
    info: {
      title: "Tasks API",
      version: "1.0.0"
    },
    docs: true
  }
});

app.listen(3000, () => {
  console.log("Tasks API running on http://localhost:3000");
  console.log("Swagger UI available at http://localhost:3000/docs");
});
