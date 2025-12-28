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
import { createAdornExpressApp } from '../../src/express.js';
import { Bindings, Controller, Delete, Get, Post, Put } from '../../src/decorators/index.js';
import { HttpError } from '../../src/core/errors/http-error.js';
import { entityDto, filtersFromEntity } from '../../src/metal-orm.js';

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
const updateUserSchema = entityDto(User, 'update');
const listUsersQuerySchema = filtersFromEntity(User, {
  pick: ['id', 'name'] as const,
  paging: false,
});
const userRef = entityRef(User);

type CreateUserInput = { name: string };
type UpdateUserInput = { name?: string };

async function loadUserEntity(session: OrmSession, id: number): Promise<User | null> {
  const rows = await selectFromEntity(User)
    .select('id', 'name')
    .where(eq(userRef.id, id))
    .execute(session);
  return rows[0] ?? null;
}

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
      qb = qb.where(eq(userRef.name, query.name));
    }

    return qb.execute(this.session);
  }

  @Bindings({ path: { id: 'int' } })
  @Get('/{id}')
  async getUser(id: number): Promise<User> {
    const user = await loadUserEntity(this.session, id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return user;
  }

  @Bindings({ path: { id: 'int' } })
  @Put('/{id}', { validate: { body: updateUserSchema } })
  async updateUser(id: number, body: UpdateUserInput): Promise<User> {
    const user = await loadUserEntity(this.session, id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    if (body.name !== undefined) {
      user.name = body.name;
      this.session.markDirty(user);
    }

    await this.session.commit();
    return user;
  }

  @Bindings({ path: { id: 'int' } })
  @Delete('/{id}')
  async deleteUser(id: number): Promise<void> {
    const user = await loadUserEntity(this.session, id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    await this.session.remove(user);
    await this.session.commit();
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

describe('metal-orm + adorn-api (REST)', () => {
  it('supports CRUD routes with orm-backed persistence', async () => {
    const { app, ctx } = await createTestApp();

    try {
      const createAda = await request(app).post('/users').send({ name: 'Ada' });
      const createGrace = await request(app).post('/users').send({ name: 'Grace' });

      expect(createAda.status).toBe(201);
      expect(createAda.body).toEqual({ id: 1, name: 'Ada' });
      expect(createGrace.status).toBe(201);
      expect(createGrace.body).toEqual({ id: 2, name: 'Grace' });

      const listAll = await request(app).get('/users');

      expect(listAll.status).toBe(200);
      expect(listAll.body).toEqual([
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' },
      ]);

      const getAda = await request(app).get('/users/1');
      expect(getAda.status).toBe(200);
      expect(getAda.body).toEqual({ id: 1, name: 'Ada' });

      const updateAda = await request(app).put('/users/1').send({ name: 'Ada Lovelace' });
      expect(updateAda.status).toBe(200);
      expect(updateAda.body).toEqual({ id: 1, name: 'Ada Lovelace' });

      const listFiltered = await request(app).get('/users').query({ name: 'Ada Lovelace' });
      expect(listFiltered.status).toBe(200);
      expect(listFiltered.body).toEqual([{ id: 1, name: 'Ada Lovelace' }]);

      const deleteAda = await request(app).delete('/users/1');
      expect(deleteAda.status).toBe(204);
      expect(deleteAda.body).toEqual({});

      const getMissing = await request(app).get('/users/1');
      expect(getMissing.status).toBe(404);
      expect(getMissing.body.title).toBe('User not found');
    } finally {
      await closeOrmContext(ctx);
    }
  });
});
