import sqlite3 from "sqlite3";

let db: sqlite3.Database;

import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export function initializeDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = join(dataDir, "tasks.db");
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

export function getDatabase(): sqlite3.Database {
  return db;
}

export function runQuery(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T);
      }
    });
  });
}

export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

export async function createTables(): Promise<void> {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6B7280'
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, tag_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);
}

export async function seedData(): Promise<void> {
  const taskCount = await getQuery<{ count: number }>("SELECT COUNT(*) as count FROM tasks");
  
  if (taskCount?.count === 0) {
    const now = new Date().toISOString();
    
    await runQuery(
      "INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Design Homepage", "Create wireframes and mockups for the homepage", "completed", "high", "2025-01-15T00:00:00.000Z", now, now]
    );
    
    await runQuery(
      "INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Implement User Authentication", "Add login and registration functionality", "in_progress", "high", "2025-01-20T00:00:00.000Z", now, now]
    );
    
    await runQuery(
      "INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Database Schema Design", "Define database tables and relationships", "completed", "high", "2025-01-10T00:00:00.000Z", now, now]
    );
    
    await runQuery(
      "INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Write Unit Tests", "Add unit tests for core functionality", "pending", "medium", "2025-01-25T00:00:00.000Z", now, now]
    );
    
    await runQuery(
      "INSERT INTO tasks (title, description, status, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["Setup CI/CD Pipeline", "Configure automated testing and deployment", "pending", "medium", "2025-01-30T00:00:00.000Z", now, now]
    );
    
    await runQuery(
      "INSERT INTO tags (name, color) VALUES (?, ?)",
      ["frontend", "#3B82F6"]
    );
    
    await runQuery(
      "INSERT INTO tags (name, color) VALUES (?, ?)",
      ["backend", "#10B981"]
    );
    
    await runQuery(
      "INSERT INTO tags (name, color) VALUES (?, ?)",
      ["urgent", "#EF4444"]
    );
    
    await runQuery(
      "INSERT INTO tags (name, color) VALUES (?, ?)",
      ["bug", "#F59E0B"]
    );
  }
}
