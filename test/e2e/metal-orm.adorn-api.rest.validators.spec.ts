import request from 'supertest';
import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';
import {
  Column,
  Entity,
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
import { createAdornExpressApp } from 'adorn-api/express';
import { Controller, Get, Post } from 'adorn-api';
import { entityDto, filtersFromEntity } from 'adorn-api/metal-orm';

type Db = sqlite3.Database;

const execSql = (db: Db, sql: string): Promise<void> =>
  new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

const allSql = <T extends Record<string, unknown> = Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });

const closeDb = (db: Db): Promise<void> =>
  new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

@Entity()
class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;
}

bootstrapEntities();

const createUserSchema = entityDto(User, 'create');
const listUsersQuerySchema = filtersFromEntity(User, {
  pick: ['id', 'name'] as const,
  paging: false,
});
const userRef = entityRef(User);

type CreateUserInput = { name: string };

@Controller('/users')
class UsersController {
  constructor(private session: OrmSession) {}

  @Post('', { validate: { body: createUserSchema } })
  async createUser(body: CreateUserInput): Promise<User> {
    const user = new User();
    user.name = body.name;

    await this.session.persist(user);
    await this.session.commit();

    const rows = await selectFromEntity(User)
      .select('id', 'name')
      .orderBy(userRef.id)
      .execute(this.session);

    const created = rows[rows.length - 1];
    if (!created) {
      throw new Error('User insert failed');
    }

    return created;
  }

  @Get('', { validate: { query: listUsersQuerySchema } })
  async listUsers(query: { id?: number; name?: string }): Promise<User[]> {
    let qb = selectFromEntity(User)
      .select('id', 'name')
      .orderBy(userRef.id);

    if (query.id !== undefined) {
      qb = qb.where(eq(userRef.id, query.id));
    } else if (query.name) {
      qb = qb.where(eq(userRef.$.name, query.name));
    }

    return qb.execute(this.session);
  }
}

type OrmContext = {
  db: Db;
  orm: Orm;
  executor: ReturnType<typeof createSqliteExecutor>;
};

async function createOrmContext(): Promise<OrmContext> {
  const db = new sqlite3.Database(':memory:');

  await execSql(
    db,
    [
      'CREATE TABLE users (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  name VARCHAR(255) NOT NULL',
      ');',
    ].join('\n'),
  );

  const executor = createSqliteExecutor({
    all: (sql, params) => allSql(db, sql, params),
    beginTransaction: () => execSql(db, 'BEGIN'),
    commitTransaction: () => execSql(db, 'COMMIT'),
    rollbackTransaction: () => execSql(db, 'ROLLBACK'),
  });

  const orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {},
    },
  });

  return { db, orm, executor };
}

async function closeOrmContext(ctx: OrmContext): Promise<void> {
  await ctx.orm.dispose();
  await closeDb(ctx.db);
}

async function createTestApp() {
  const ctx = await createOrmContext();
  const app = createAdornExpressApp({
    controllers: [UsersController],
    controllerFactory: (_ctor, _req, res) => {
      const session = new OrmSession({ orm: ctx.orm, executor: ctx.executor });
      res.on('finish', () => {
        void session.dispose();
      });
      return new UsersController(session);
    },
  });

  return { app, ctx };
}

describe('metal-orm + adorn-api (REST validators)', () => {
  it('rejects bodies that violate the entity dto schema', async () => {
    const { app, ctx } = await createTestApp();

    try {
      const res = await request(app).post('/users').send({});

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Validation Error');
      expect(res.body.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['body', 'name'] })]),
      );
    } finally {
      await closeOrmContext(ctx);
    }
  });

  it('rejects queries that violate the generated filters', async () => {
    const { app, ctx } = await createTestApp();

    try {
      const res = await request(app).get('/users').query({ name: 123 });

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Validation Error');
      expect(res.body.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['query', 'name'] })]),
      );
    } finally {
      await closeOrmContext(ctx);
    }
  });
});
