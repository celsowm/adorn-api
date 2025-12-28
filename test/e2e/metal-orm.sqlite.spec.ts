import sqlite3 from 'sqlite3';
import { describe, expect, it } from 'vitest';
import {
  BelongsTo,
  BelongsToReference,
  Column,
  Entity,
  HasMany,
  HasManyCollection,
  Orm,
  OrmSession,
  PrimaryKey,
  SqliteDialect,
  bootstrapEntities,
  col,
  createSqliteExecutor,
  entityRef,
  eq,
  selectFromEntity,
} from 'metal-orm';

@Entity()
class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.varchar(255))
  email?: string;

  @HasMany({
    target: () => Post,
    foreignKey: 'userId',
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
    foreignKey: 'userId',
  })
  user!: BelongsToReference<User>;
}

type SqliteSession = {
  orm: Orm;
  session: OrmSession;
  execAll: (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;
};

const createSqliteMemorySession = async (): Promise<SqliteSession> => {
  const db = new sqlite3.Database(':memory:');
  const execAll = (sql: string, params: unknown[] = []) =>
    new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows ?? []);
      });
    });

  const executor = createSqliteExecutor({
    all: execAll,
    beginTransaction: () => execAll('BEGIN'),
    commitTransaction: () => execAll('COMMIT'),
    rollbackTransaction: () => execAll('ROLLBACK'),
  });

  const orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: () =>
        new Promise<void>((resolve, reject) => {
          db.close(err => (err ? reject(err) : resolve()));
        }),
    },
  });

  const session = new OrmSession({ orm, executor });

  return { orm, session, execAll };
};

describe('metal-orm sqlite memory', () => {
  it('persists and queries decorator entities with OrmSession', async () => {
    const { orm, session, execAll } = await createSqliteMemorySession();

    try {
      bootstrapEntities();

      await execAll('PRAGMA foreign_keys = ON');
      await execAll(
        'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT)'
      );
      await execAll(
        'CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, userId INTEGER NOT NULL)'
      );

      const user = new User();
      user.name = 'Ada';
      user.email = 'ada@example.com';

      await session.persist(user);
      await session.commit();

      expect(user.id).toBeTypeOf('number');

      const U = entityRef(User);
      const [loaded] = await selectFromEntity(User)
        .includeLazy('posts')
        .where(eq(U.id, user.id))
        .execute(session);

      expect(loaded).toBeInstanceOf(User);

      loaded.posts.add({ title: 'From decorators' });
      await session.commit();

      const P = entityRef(Post);
      const posts = await selectFromEntity(Post)
        .select('id', 'title', 'userId')
        .where(eq(P.userId, user.id))
        .executePlain(session);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({
        title: 'From decorators',
        userId: user.id,
      });
    } finally {
      await session.dispose();
      await orm.dispose();
    }
  });
});
