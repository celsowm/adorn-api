import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';
import type { HasManyCollection } from 'metal-orm';
import {
  BelongsTo,
  Column,
  Entity,
  HasMany,
  Orm,
  OrmSession,
  PrimaryKey,
  SqliteDialect,
  bootstrapEntities,
  col,
  createSqliteExecutor,
  entityRef,
  selectFromEntity
} from 'metal-orm';

type Db = sqlite3.Database;

const execSql = (db: Db, sql: string): Promise<void> =>
  new Promise((resolve, reject) => {
    db.exec(sql, err => {
      if (err) reject(err);
      else resolve();
    });
  });

const runSql = (db: Db, sql: string, params: unknown[] = []): Promise<void> =>
  new Promise((resolve, reject) => {
    db.run(sql, params, err => {
      if (err) reject(err);
      else resolve();
    });
  });

const allSql = <T extends Record<string, unknown> = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = []
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });

const closeDb = (db: Db): Promise<void> =>
  new Promise((resolve, reject) => {
    db.close(err => {
      if (err) reject(err);
      else resolve();
    });
  });

describe('metal-orm decorators (SQLite memory)', () => {
  it('persists has-many add after selectFromEntity', async () => {
    @Entity()
    class User {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.notNull(col.varchar(255)))
      name!: string;

      @HasMany({
        target: () => Post,
        foreignKey: 'userId'
      })
      posts!: HasManyCollection<Post>;
    }

    @Entity()
    class Post {
      @PrimaryKey(col.autoIncrement(col.int()))
      id!: number;

      @Column(col.notNull(col.varchar(255)))
      title!: string;

      @Column(col.notNull(col.int()))
      userId!: number;

      @BelongsTo({
        target: () => User,
        foreignKey: 'userId'
      })
      user?: User;
    }

    const db = new sqlite3.Database(':memory:');

    try {
      bootstrapEntities();

      await execSql(
        db,
        [
          'CREATE TABLE users (',
          '  id INTEGER PRIMARY KEY,',
          '  name VARCHAR(255) NOT NULL',
          ');',
          'CREATE TABLE posts (',
          '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
          '  title VARCHAR(255) NOT NULL,',
          '  userId INTEGER NOT NULL,',
          '  FOREIGN KEY (userId) REFERENCES users(id)',
          ');'
        ].join('\n')
      );

      await runSql(db, 'INSERT INTO users (id, name) VALUES (?, ?);', [1, 'Ada']);

      const executor = createSqliteExecutor({
        all: (sql, params) => allSql(db, sql, params),
        beginTransaction: () => execSql(db, 'BEGIN'),
        commitTransaction: () => execSql(db, 'COMMIT'),
        rollbackTransaction: () => execSql(db, 'ROLLBACK')
      });

      const orm = new Orm({
        dialect: new SqliteDialect(),
        executorFactory: {
          createExecutor: () => executor,
          createTransactionalExecutor: () => executor,
          dispose: async () => {}
        }
      });

      const session = new OrmSession({ orm, executor });

      const [user] = await selectFromEntity(User)
        .select('id', 'name')
        .includeLazy('posts')
        .execute(session);

      user.posts.add({ title: 'From selectFromEntity' });
      await session.commit();

      const postsRef = entityRef(Post);
      const posts = await selectFromEntity(Post)
        .select('id', 'title', 'userId')
        .orderBy(postsRef.id)
        .execute(session);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({
        title: 'From selectFromEntity',
        userId: 1
      });
    } finally {
      await closeDb(db);
    }
  });
});
