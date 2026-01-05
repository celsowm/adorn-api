import { Controller, Get, Post } from "../../dist/index.js";
import type { ListQuery } from "../../dist/metal/index.js";
import { applyListQuery } from "../../dist/metal/index.js";
import type { PaginatedResult } from "metal-orm";
import { getSession } from "./db.js";
import { Task } from "./entity.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/tasks")
export class TasksController {
  @Get("/")
  async list(query: ListQuery<Task>): Promise<PaginatedResult<Task>> {
    const session = getSession();
    const T = entityRef(Task);

    const qb = selectFromEntity(Task)
      .select("id", "title", "completed", "createdAt");

    return applyListQuery(qb, session, query);
  }

  @Get("/:id")
  async get(id: number): Promise<Task | null> {
    const session = getSession();
    const [task] = await selectFromEntity(Task)
      .select("id", "title", "completed", "createdAt")
      .where(eq(entityRef(Task).id, id))
      .execute(session);
    return task ?? null;
  }

  @Post("/")
  async create(body: { title: string }): Promise<Task> {
    const session = getSession();
    const task = await session.saveGraphAndFlush(
      Task,
      {
        title: body.title,
        completed: false,
        createdAt: new Date(),
      }
    );
    return task;
  }
}
