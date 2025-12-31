import { Controller, Get, Post, Put, Delete } from "adorn-api";
import { getQuery, allQuery, runQuery } from "./db.js";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface TaskWithTags extends Task {
  tags: Tag[];
}

@Controller("/tasks")
export class TasksController {
  @Get("/")
  async getTasks(
    query?: { status?: string; priority?: string; search?: string }
  ): Promise<Task[]> {
    let sql = "SELECT * FROM tasks";
    const params: any[] = [];
    const conditions: string[] = [];

    if (query?.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query?.priority) {
      conditions.push("priority = ?");
      params.push(query.priority);
    }

    if (query?.search) {
      conditions.push("(title LIKE ? OR description LIKE ?)");
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY created_at DESC";

    return allQuery<Task>(sql, params);
  }

  @Get("/:id")
  async getTask(id: number): Promise<TaskWithTags | null> {
    const task = await getQuery<Task>("SELECT * FROM tasks WHERE id = ?", [id]);

    if (!task) {
      return null;
    }

    const tags = await allQuery<Tag>(
      `SELECT t.id, t.name, t.color FROM tags t
       INNER JOIN task_tags tt ON t.id = tt.tag_id
       WHERE tt.task_id = ?`,
      [id]
    );

    return { ...task, tags };
  }

  @Post("/")
  async createTask(
    body: {
      title: string;
      description?: string;
      status?: "pending" | "in_progress" | "completed";
      priority?: "low" | "medium" | "high";
      due_date?: string;
    }
  ): Promise<Task> {
    const now = new Date().toISOString();
    const result = await runQuery(
      `INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        body.title,
        body.description || null,
        body.status || "pending",
        body.priority || "medium",
        body.due_date || null,
        now,
        now,
      ]
    );

    const task = await getQuery<Task>("SELECT * FROM tasks WHERE id = ?", [result.lastID]);

    if (!task) {
      throw new Error("Failed to create task");
    }

    return task;
  }

  @Put("/:id")
  async updateTask(
    id: number,
    body: Partial<{
      title: string;
      description: string;
      status: "pending" | "in_progress" | "completed";
      priority: "low" | "medium" | "high";
      due_date: string;
    }>
  ): Promise<Task | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (body.title !== undefined) {
      updates.push("title = ?");
      params.push(body.title);
    }

    if (body.description !== undefined) {
      updates.push("description = ?");
      params.push(body.description);
    }

    if (body.status !== undefined) {
      updates.push("status = ?");
      params.push(body.status);
    }

    if (body.priority !== undefined) {
      updates.push("priority = ?");
      params.push(body.priority);
    }

    if (body.due_date !== undefined) {
      updates.push("due_date = ?");
      params.push(body.due_date);
    }

    if (updates.length === 0) {
      return getQuery<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
    }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`;
    await runQuery(sql, params);

    return getQuery<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
  }

  @Delete("/:id")
  async deleteTask(id: number): Promise<{ success: boolean }> {
    const result = await runQuery("DELETE FROM tasks WHERE id = ?", [id]);
    return { success: result.changes > 0 };
  }

  @Post("/:id/tags")
  async addTagToTask(
    id: number,
    body: { tag_id: number }
  ): Promise<{ success: boolean }> {
    await runQuery("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", [
      id,
      body.tag_id,
    ]);
    return { success: true };
  }

  @Delete("/:id/tags/:tagId")
  async removeTagFromTask(
    id: number,
    tagId: number
  ): Promise<{ success: boolean }> {
    const result = await runQuery(
      "DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?",
      [id, tagId]
    );
    return { success: result.changes > 0 };
  }
}

@Controller("/tags")
export class TagsController {
  @Get("/")
  async getTags(): Promise<Tag[]> {
    return allQuery<Tag>("SELECT * FROM tags ORDER BY name ASC");
  }

  @Post("/")
  async createTag(body: { name: string; color?: string }): Promise<Tag> {
    const result = await runQuery("INSERT INTO tags (name, color) VALUES (?, ?)", [
      body.name,
      body.color || "#6B7280",
    ]);

    const tag = await getQuery<Tag>("SELECT * FROM tags WHERE id = ?", [result.lastID]);

    if (!tag) {
      throw new Error("Failed to create tag");
    }

    return tag;
  }

  @Delete("/:id")
  async deleteTag(id: number): Promise<{ success: boolean }> {
    const result = await runQuery("DELETE FROM tags WHERE id = ?", [id]);
    return { success: result.changes > 0 };
  }
}

@Controller("/stats")
export class StatsController {
  @Get("/")
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const totalResult = await getQuery<{ count: number }>(
      "SELECT COUNT(*) as count FROM tasks"
    );

    const byStatus = await allQuery<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
    );

    const byPriority = await allQuery<{ priority: string; count: number }>(
      "SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority"
    );

    const statusMap: Record<string, number> = {};
    byStatus.forEach((row) => {
      statusMap[row.status] = row.count;
    });

    const priorityMap: Record<string, number> = {};
    byPriority.forEach((row) => {
      priorityMap[row.priority] = row.count;
    });

    return {
      total: totalResult?.count || 0,
      byStatus: statusMap,
      byPriority: priorityMap,
    };
  }
}
