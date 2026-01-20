import {
  Body,
  Controller,
  Delete,
  Get,
  HttpError,
  Params,
  Patch,
  Post,
  Put,
  Query,
  Returns,
  coerce,
  t,
  type RequestContext
} from "../../src";
import {
  CreateTaskDto,
  ReplaceTaskDto,
  TaskDto,
  TaskErrors,
  TaskParamsDto,
  TaskQueryDto,
  UpdateTaskDto
} from "./task.dtos";
import {
  createTask,
  getTask,
  listTasks,
  removeTask,
  replaceTask,
  updateTask
} from "./task.store";

function parseTaskId(value: string) {
  const id = coerce.id(value);
  if (id === undefined) {
    throw new HttpError(400, "Invalid task id.");
  }
  return id;
}

@Controller("/tasks")
export class TaskController {
  @Get("/")
  @Query(TaskQueryDto)
  @Returns(t.array(t.ref(TaskDto)))
  list(ctx: RequestContext<unknown, TaskQueryDto>) {
    const offset =
      coerce.integer(ctx.query?.offset, { min: 0, clamp: true }) ?? 0;
    const limit =
      coerce.integer(ctx.query?.limit, { min: 1, max: 100, clamp: true }) ??
      25;
    const completed = coerce.boolean(ctx.query?.completed);

    return listTasks({ offset, limit, completed });
  }

  @Get("/:id")
  @Params(TaskParamsDto)
  @Returns(TaskDto)
  @TaskErrors
  getOne(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseTaskId(ctx.params.id);
    const task = getTask(id);
    if (!task) {
      throw new HttpError(404, "Task not found.");
    }
    return task;
  }

  @Post("/")
  @Body(CreateTaskDto)
  @Returns({ status: 201, schema: TaskDto, description: "Created." })
  create(ctx: RequestContext<CreateTaskDto>) {
    return createTask(ctx.body);
  }

  @Put("/:id")
  @Params(TaskParamsDto)
  @Body(ReplaceTaskDto)
  @Returns(TaskDto)
  @TaskErrors
  replace(ctx: RequestContext<ReplaceTaskDto, undefined, { id: string }>) {
    const id = parseTaskId(ctx.params.id);
    const updated = replaceTask(id, ctx.body);
    if (!updated) {
      throw new HttpError(404, "Task not found.");
    }
    return updated;
  }

  @Patch("/:id")
  @Params(TaskParamsDto)
  @Body(UpdateTaskDto)
  @Returns(TaskDto)
  @TaskErrors
  update(ctx: RequestContext<UpdateTaskDto, undefined, { id: string }>) {
    const id = parseTaskId(ctx.params.id);
    const task = updateTask(id, ctx.body);
    if (!task) {
      throw new HttpError(404, "Task not found.");
    }
    return task;
  }

  @Delete("/:id")
  @Params(TaskParamsDto)
  @Returns({ status: 204, description: "Deleted." })
  @TaskErrors
  remove(ctx: RequestContext<unknown, undefined, { id: string }>) {
    const id = parseTaskId(ctx.params.id);
    const removed = removeTask(id);
    if (!removed) {
      throw new HttpError(404, "Task not found.");
    }
  }
}
