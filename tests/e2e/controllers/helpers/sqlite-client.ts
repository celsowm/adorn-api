import sqlite3 from 'sqlite3';
import type { SqliteClientLike } from 'metal-orm';

export class SqlitePromiseClient implements SqliteClientLike {
  constructor(private readonly db: sqlite3.Database) {}

  all(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Array<Record<string, unknown>>);
      });
    });
  }

  run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async beginTransaction(): Promise<void> {
    await this.run('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    await this.run('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.run('ROLLBACK');
  }
}
