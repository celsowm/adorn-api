import { Controller, Get, Post, Paginated } from "adorn-api";
import type { PaginationParams, PaginatedResponse } from "adorn-api";
import { getSession } from "./db.js";
import { Task } from "./entity.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/tasks")
export class TasksController {

  @Get("/")
  @Paginated({ defaultPageSize: 5 })
  async list(
    pagination: PaginationParams
  ): Promise<PaginatedResponse<Task>> {
    const session = getSession();
    const T = entityRef(Task);

    const { page, pageSize } = pagination;

    const qb = selectFromEntity(Task)
      .select("id", "title", "completed", "createdAt")
      .orderBy(T.createdAt, "DESC");

    const { items, totalItems } = await qb.executePaged(session, {
      page,
      pageSize,
    });

    return {
      items,
      totalItems,
      page,
      pageSize,
    };
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
