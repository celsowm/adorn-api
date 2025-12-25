import { z } from 'zod';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  EmptyQuery,
  EmptyResponse,
  entitySchemas,
  NotFoundError,
} from '../../../src/index.js';
import type { RequestContext, EntitySelection } from '../../../src/index.js';
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

const userSchemas = entitySchemas(User, {
  idPrefix: 'MetalOrmEntity',
  overrides: {
    all: {
      email: z.string().email(),
    },
    query: {
      name: z.string().min(1),
    },
  },
});

const userView = userSchemas.pick('id', 'name', 'email', 'createdAt');
const userWrite = userSchemas.body('name', 'email');
const userSearch = userSchemas.query('name', 'email');

const UserResponse = userView.response();
const UserListResponse = userView.list();
const CountResponse = userSchemas.aggregates.count();
const UserParams = userSchemas.params();
const CreateUserBody = userWrite.create();
const UpdateUserBody = userWrite.partial().update();
const SearchQuery = userSearch.schema();

type UserDto = EntitySelection<User, typeof userView.fields>;

@Controller('/metal-orm-entity-users')
export class MetalOrmEntityUsersController {
  private readonly db: sqlite3.Database;
  private readonly sqliteClient: SqlitePromiseClient;
  protected readonly orm: Orm;
  protected readonly ready: Promise<void>;
  private readonly table: TableDef;
  private readonly columnSelection: Record<string, ColumnDef>;
  private readonly searchFields = userSearch.fields;

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

    this.table = userSchemas.table;
    this.columnSelection = userView.selection;
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

  private formatUser(user: Record<string, unknown>): UserDto {
    const createdAtRaw = user.createdAt;
    const createdAt =
      createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : typeof createdAtRaw === 'string'
          ? createdAtRaw
          : new Date().toISOString();

    return {
      id: typeof user.id === 'number' ? user.id : Number(user.id ?? 0),
      name: typeof user.name === 'string' ? user.name : '',
      email: typeof user.email === 'string' ? user.email : null,
      createdAt,
    };
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
      return rows.map((row) => this.formatUser(row as Record<string, unknown>));
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
  async search(ctx: RequestContext): Promise<UserDto[]> {
    await this.ready;
    const input = ctx.input.query as Record<string, unknown>;
    return this.withSession(async (session) => {
      let queryBuilder = selectFromEntity(User)
        .select(this.columnSelection)
        .orderBy(this.table.columns.id, 'ASC');
      const condition = this.buildSearchCondition(input);
      if (condition) {
        queryBuilder = queryBuilder.where(condition);
      }
      const rows = await queryBuilder.execute(session);
      return rows.map((row) => this.formatUser(row as Record<string, unknown>));
    });
  }

  @Get('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
  })
  async get(ctx: RequestContext): Promise<UserDto> {
    await this.ready;
    const { id } = ctx.input.params as { id: number };
    return this.withSession(async (session) => {
      const user = await session.find(User, id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return this.formatUser(user as unknown as Record<string, unknown>);
    });
  }

  @Post('/', {
    query: EmptyQuery,
    body: CreateUserBody,
    response: UserResponse,
  })
  async create(ctx: RequestContext): Promise<UserDto> {
    await this.ready;
    const body = ctx.input.body as { name: string; email?: string };
    return this.withSession(async (session) => {
      const user = new User();
      user.name = body.name;
      user.email = body.email ?? null;
      await session.persist(user);
      await session.commit();
      return this.formatUser(user as unknown as Record<string, unknown>);
    });
  }

  @Put('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    body: UpdateUserBody,
    response: UserResponse,
  })
  async update(ctx: RequestContext): Promise<UserDto> {
    await this.ready;
    const { id } = ctx.input.params as { id: number };
    const body = ctx.input.body as { name?: string; email?: string | null };
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
      return this.formatUser(user as unknown as Record<string, unknown>);
    });
  }

  @Delete('/{id}', {
    params: UserParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async remove(ctx: RequestContext): Promise<void> {
    await this.ready;
    const { id } = ctx.input.params as { id: number };
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
