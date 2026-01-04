import { Controller, Get, Post, Paginated } from "adorn-api";
import type { PaginationParams } from "adorn-api";
import { getSession } from "./db.js";
import { Task } from "./entity.js";
import { selectFromEntity, entityRef, eq, type PaginatedResult } from "metal-orm";

@Controller("/tasks")
export class TasksController {

  @Get("/")
  @Paginated({ defaultPageSize: 5 })
  async list(
    pagination: PaginationParams
  ): Promise<PaginatedResult<Task>> {
    const session = getSession();
    const T = entityRef(Task);

    const { page, pageSize } = pagination;

    const qb = selectFromEntity(Task)
      .select("id", "title", "completed", "createdAt")
      .orderBy(T.createdAt, "DESC");

    return qb.executePaged(session, { page, pageSize });
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
