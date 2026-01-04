import { Controller, Get, Paginated } from "../../../../dist/index.js";
import type { PaginationParams, PaginatedResponse } from "../../../../dist/index.js";

class TaskDto {
  id!: number;
  title!: string;
  completed!: boolean;
}

const tasks: TaskDto[] = [
  { id: 1, title: "Task 1", completed: false },
  { id: 2, title: "Task 2", completed: true },
];

@Controller("/tasks")
export class TasksController {
  @Get("/")
  @Paginated({ defaultPageSize: 10 })
  async list(pagination: PaginationParams): Promise<PaginatedResponse<TaskDto>> {
    const { page, pageSize } = pagination;
    const start = (page - 1) * pageSize;
    const items = tasks.slice(start, start + pageSize);
    return {
      items,
      totalItems: tasks.length,
      page,
      pageSize,
    };
  }

  @Get("/custom")
  @Paginated({ defaultPageSize: 20 })
  async customList(pagination: PaginationParams): Promise<PaginatedResponse<TaskDto>> {
    return {
      items: tasks,
      totalItems: tasks.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
  }
}
