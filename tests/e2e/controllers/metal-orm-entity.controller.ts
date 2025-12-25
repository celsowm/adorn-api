import { z } from 'zod';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  EmptyQuery,
  EmptyResponse,
  entityContract,
  fieldsOf,
  parseEntityView,
  parseEntityViewList,
  NotFoundError,
} from '../../../src/index.js';
import type { InferSchema, TypedRequestContext } from '../../../src/index.js';
import {
  Entity,
  Column,
  PrimaryKey,
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  selectFromEntity,
  count,
  eq,
  and,
  col,
  bootstrapEntities,
} from 'metal-orm';
import type { TableDef, ColumnDef, ExpressionNode, OrmSession } from 'metal-orm';
import sqlite3 from 'sqlite3';
import { SqlitePromiseClient } from './helpers/sqlite-client.js';
@Entity({
  hooks: {
    beforeInsert(_ctx, entity) {
      const user = entity as User;
      user.name = user.name.trim();
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
      if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
      }
    },
    beforeUpdate(_ctx, entity) {
      const user = entity as User;
      user.name = user.name.trim();
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
    },
  },
})
class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.unique(col.varchar(255)))
  email?: string | null;

  @Column(col.timestamp())
  createdAt?: string;
}

bootstrapEntities();

const userContract = entityContract(
  User,
  {
    idPrefix: 'MetalOrmEntity',
    overrides: {
      all: {
        email: z.string().email(),
      },
      query: {
        name: z.string().min(1),
      },
    },
  },
  {
    view: fieldsOf<User>()('id', 'name', 'email', 'createdAt'),
    write: fieldsOf<User>()('name', 'email'),
    query: fieldsOf<User>()('name', 'email'),
    params: fieldsOf<User>()('id'),
  },
);

const UserResponse = userContract.refs.response;
const UserListResponse = userContract.refs.list;
const CountResponse = userContract.refs.count;
const UserParams = userContract.refs.params;
const CreateUserBody = userContract.refs.body;
const UpdateUserBody = userContract.refs.bodyPartial;
const SearchQuery = userContract.refs.query;

type UserDto = typeof userContract.types.dto;
type EmptyQueryInput = InferSchema<typeof EmptyQuery>;
type UserParamsCtx = TypedRequestContext<typeof userContract.types.params, EmptyQueryInput, undefined>;
type UserSearchCtx = TypedRequestContext<{}, typeof userContract.types.queryInput, undefined>;
type UserCreateCtx = TypedRequestContext<{}, EmptyQueryInput, typeof userContract.types.body>;
type UserUpdateCtx = TypedRequestContext<
  typeof userContract.types.params,
  EmptyQueryInput,
  typeof userContract.types.bodyPartial
>;
type UserRemoveCtx = TypedRequestContext<typeof userContract.types.params, EmptyQueryInput, undefined>;

@Controller('/metal-orm-entity-users')
export class MetalOrmEntityUsersController {
  private readonly db: sqlite3.Database;
  private readonly sqliteClient: SqlitePromiseClient;
  protected readonly orm: Orm;
  protected readonly ready: Promise<void>;
  private readonly table: TableDef;
  private readonly columnSelection: Record<string, ColumnDef>;
  private readonly searchFields = userContract.query.fields;

  constructor() {
    this.db = new sqlite3.Database(':memory:');
    this.sqliteClient = new SqlitePromiseClient(this.db);
    const dialect = new SqliteDialect();
    this.orm = new Orm({
      dialect,
      executorFactory: {
        createExecutor: () => createSqliteExecutor(this.sqliteClient),
        createTransactionalExecutor: () => createSqliteExecutor(this.sqliteClient),
        dispose: async () => {},
      },
    });

    this.table = userContract.table;
    this.columnSelection = userContract.selection;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.runSql(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        createdAt TEXT NOT NULL
      )
    `);

    const now = new Date().toISOString();
    await this.runSql(
      `
        INSERT INTO users (name, email, createdAt) VALUES
          ('Alice', 'alice@example.com', ?),
          ('Bob', 'bob@example.com', ?)
      `,
      [now, now],
    );
  }

  private runSql(sql: string, params: unknown[] = []): Promise<void> {
    return this.sqliteClient.run(sql, params);
  }

  private createSession(): OrmSession {
    return this.orm.createSession();
  }

  private async withSession<T>(fn: (session: OrmSession) => Promise<T>): Promise<T> {
    const session = this.createSession();
    try {
      return await fn(session);
    } finally {
      await session.dispose();
    }
  }

  private async fetchUserById(session: OrmSession, id: number | string): Promise<UserDto> {
    const rows = await selectFromEntity(User)
      .select(this.columnSelection)
      .where(eq(this.table.columns.id, id))
      .execute(session);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError('User not found');
    }
    return parseEntityView(userContract.view, row);
  }

  private buildSearchCondition(input: Record<string, unknown>): ExpressionNode | undefined {
    let condition: ExpressionNode | undefined;
    for (const field of this.searchFields) {
      const value = input[field];
      if (value === undefined || value === null || value === '') continue;
      const column = this.table.columns[field];
      if (!column) continue;
      const next = eq(column, value as string | number | boolean);
      condition = condition ? and(condition, next) : next;
    }
    return condition;
  }

  @Get('/', {
    query: EmptyQuery,
    response: UserListResponse,
  })
  async list(): Promise<UserDto[]> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = await selectFromEntity(User)
        .select(this.columnSelection)
        .orderBy(this.table.columns.id, 'ASC')
        .execute(session);
      return parseEntityViewList(userContract.view, rows);
    });
  }

  @Get('/count', {
    query: EmptyQuery,
    response: CountResponse,
  })
  async count(): Promise<{ count: number }> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = (await selectFromEntity(User)
        .select({ count: count(this.table.columns.id) })
        .execute(session)) as Array<{ count?: number | string | null }>;
      const value = rows[0]?.count;
      return { count: typeof value === 'number' ? value : Number(value ?? 0) };
    });
  }

  @Get('/search', {
    query: SearchQuery,
    response: UserListResponse,
  })
  async search(ctx: UserSearchCtx): Promise<UserDto[]> {
    await this.ready;
    const input = ctx.input.query;
    return this.withSession(async (session) => {
      let queryBuilder = selectFromEntity(User)
        .select(this.columnSelection)
        .orderBy(this.table.columns.id, 'ASC');
      const condition = this.buildSearchCondition(input);
      if (condition) {
        queryBuilder = queryBuilder.where(condition);
      }
      const rows = await queryBuilder.execute(session);
      return parseEntityViewList(userContract.view, rows);
    });
  }

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async get(ctx: UserParamsCtx): Promise<UserDto> {
    await this.ready;
    const { id } = ctx.input.params;
    return this.withSession(async (session) => {
      return this.fetchUserById(session, id);
    });
  }

  @Post('/', {
    query: EmptyQuery,
    body: CreateUserBody,
    response: UserResponse,
  })
  async create(ctx: UserCreateCtx): Promise<UserDto> {
    await this.ready;
    const body = ctx.input.body;
    return this.withSession(async (session) => {
      const user = new User();
      user.name = body.name;
      user.email = body.email ?? null;
      await session.persist(user);
      await session.commit();
      const persistedId = (user as unknown as { id?: number | string }).id;
      if (persistedId === undefined || persistedId === null) {
        throw new NotFoundError('User not found');
      }
      return this.fetchUserById(session, persistedId as number | string);
    });
  }

  @Put('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    body: UpdateUserBody,
    response: UserResponse,
  })
  async update(ctx: UserUpdateCtx): Promise<UserDto> {
    await this.ready;
    const { id } = ctx.input.params;
    const body = ctx.input.body;
    return this.withSession(async (session) => {
      const user = await session.find(User, id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      if (body.name !== undefined) {
        user.name = body.name;
      }
      if (body.email !== undefined) {
        user.email = body.email;
      }
      await session.commit();
      return this.fetchUserById(session, id);
    });
  }

  @Delete('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async remove(ctx: UserRemoveCtx): Promise<void> {
    await this.ready;
    const { id } = ctx.input.params;
    return this.withSession(async (session) => {
      const user = await session.find(User, id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      await session.remove(user);
      await session.commit();
    });
  }
}
