import { Controller, Get, Post } from "adorn-api";
import { getSession } from "./db.js";
import { Task } from "./entity.js";
import { selectFromEntity, entityRef, eq } from "metal-orm";

@Controller("/tasks")
export class TasksController {

  @Get("/")
  async list(
    page?: string,
    pageSize?: string
  ): Promise<{ items: Task[]; totalItems: number; page: number; pageSize: number }> {
    const session = getSession();
    const T = entityRef(Task);

    const pageNum = page ? parseInt(page, 10) : 1;
    const size = pageSize ? parseInt(pageSize, 10) : 5;

    const qb = selectFromEntity(Task)
      .select("id", "title", "completed", "createdAt")
      .orderBy(T.createdAt, "DESC");

    const { items, totalItems } = await qb.executePaged(session, {
      page: pageNum,
      pageSize: size,
    });

    return {
      items,
      totalItems,
      page: pageNum,
      pageSize: size,
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
