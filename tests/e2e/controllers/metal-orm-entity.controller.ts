import { z } from 'zod';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  EmptyQuery,
  EmptyResponse,
  named,
  entityContract,
  fieldsOf,
  parseEntityView,
  NotFoundError,
} from '../../../src/index.js';
import type { InferSchema, TypedRequestContext } from '../../../src/index.js';
import {
  Entity,
  Column,
  PrimaryKey,
  BelongsToMany,
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
import type {
  TableDef,
  ColumnDef,
  ExpressionNode,
  OrmSession,
  ManyToManyCollection,
} from 'metal-orm';
import sqlite3 from 'sqlite3';
import { SqlitePromiseClient } from './helpers/sqlite-client.js';

@Entity()
class Service {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;
}

@Entity()
class ClientService {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  clientId!: number;

  @Column(col.notNull(col.int()))
  serviceId!: number;
}

@Entity({
  hooks: {
    beforeInsert(_ctx, entity) {
      const client = entity as Client;
      client.name = client.name.trim();
      if (client.email) {
        client.email = client.email.toLowerCase();
      }
      if (!client.createdAt) {
        client.createdAt = new Date().toISOString();
      }
    },
    beforeUpdate(_ctx, entity) {
      const client = entity as Client;
      client.name = client.name.trim();
      if (client.email) {
        client.email = client.email.toLowerCase();
      }
    },
  },
})
class Client {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.unique(col.varchar(255)))
  email?: string | null;

  @Column(col.timestamp())
  createdAt?: string;

  @BelongsToMany({
    target: () => Service,
    pivotTable: () => ClientService,
    pivotForeignKeyToRoot: 'clientId',
    pivotForeignKeyToTarget: 'serviceId',
  })
  services!: ManyToManyCollection<Service, ClientService>;
}

bootstrapEntities();

const clientContract = entityContract(
  Client,
  {
    idPrefix: 'MetalOrmEntity',
    overrides: {
      all: {
        email: z.email(),
      },
      query: {
        name: z.string().min(1),
      },
    },
  },
  {
    view: fieldsOf<Client>()('id', 'name', 'email', 'createdAt'),
    write: fieldsOf<Client>()('name', 'email'),
    query: fieldsOf<Client>()('name', 'email'),
    params: fieldsOf<Client>()('id'),
  },
);

const baseId = clientContract.schemas.baseId;
const clientResponseSchema = clientContract.view.responseSchema.extend({
  serviceIds: z.array(z.number().int()),
});
const clientListSchema = z.array(clientResponseSchema);
const ClientResponse = named(`${baseId}Response`, clientResponseSchema);
const ClientListResponse = named(`${baseId}ListResponse`, clientListSchema);
const CountResponse = clientContract.refs.count;
const ClientParams = clientContract.refs.params;
const createClientSchema = clientContract.write.zod().and(
  z.object({
    serviceIds: z.array(z.number().int()).optional(),
  }),
);
const updateClientSchema = clientContract.write.partial().zod().and(
  z.object({
    serviceIds: z.array(z.number().int()).optional(),
  }),
);
const CreateClientBody = named(
  `${clientContract.schemas.idPrefix}Create${clientContract.schemas.entityName}Body`,
  createClientSchema,
);
const UpdateClientBody = named(
  `${clientContract.schemas.idPrefix}Update${clientContract.schemas.entityName}Body`,
  updateClientSchema,
);
const SearchQuery = clientContract.refs.query;

type ClientDto = typeof clientContract.types.dto;
type ClientDtoWithServices = ClientDto & { serviceIds: number[] };
type ClientCreateBody = {
  name: string;
  email?: string | null;
  serviceIds?: number[];
};
type ClientUpdateBody = {
  name?: string;
  email?: string | null;
  serviceIds?: number[];
};
type EmptyQueryInput = InferSchema<typeof EmptyQuery>;
type ClientRow = {
  id: number | string;
  name: string;
  email?: string | null;
  createdAt?: string | null;
  services?: ManyToManyCollection<{ id?: number | string }>;
};
type ClientParamsCtx = TypedRequestContext<typeof clientContract.types.params, EmptyQueryInput, undefined>;
type ClientSearchCtx = TypedRequestContext<{}, typeof clientContract.types.queryInput, undefined>;
type ClientCreateCtx = TypedRequestContext<{}, EmptyQueryInput, ClientCreateBody>;
type ClientUpdateCtx = TypedRequestContext<
  typeof clientContract.types.params,
  EmptyQueryInput,
  ClientUpdateBody
>;
type ClientRemoveCtx = TypedRequestContext<typeof clientContract.types.params, EmptyQueryInput, undefined>;

@Controller('/metal-orm-entity-clients')
export class MetalOrmEntityClientsController {
  private readonly db: sqlite3.Database;
  private readonly sqliteClient: SqlitePromiseClient;
  protected readonly orm: Orm;
  protected readonly ready: Promise<void>;
  private readonly table: TableDef;
  private readonly columnSelection: Record<string, ColumnDef>;
  private readonly searchFields = clientContract.query.fields;

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

    this.table = clientContract.table;
    this.columnSelection = clientContract.selection;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.runSql(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        createdAt TEXT NOT NULL
      )
    `);
    await this.runSql(`
      CREATE TABLE services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
    await this.runSql(`
      CREATE TABLE client_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clientId INTEGER NOT NULL,
        serviceId INTEGER NOT NULL
      )
    `);

    const now = new Date().toISOString();
    await this.runSql(
      `
        INSERT INTO clients (name, email, createdAt) VALUES
          ('Alice', 'alice@example.com', ?),
          ('Bob', 'bob@example.com', ?)
      `,
      [now, now],
    );
    await this.runSql(`
      INSERT INTO services (name) VALUES
        ('Consulting'),
        ('Support'),
        ('Delivery')
    `);
    await this.runSql(`
      INSERT INTO client_services (clientId, serviceId) VALUES
        (1, 1),
        (1, 2),
        (2, 2),
        (2, 3)
    `);
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

  private baseClientQuery() {
    return selectFromEntity(Client)
      .select(this.columnSelection)
      .include('services', { columns: ['id'] });
  }

  private extractServiceIds(client: ClientRow): number[] {
    const services = client.services;
    if (!services || typeof services.getItems !== 'function') {
      return [];
    }
    const ids: number[] = [];
    for (const service of services.getItems() ?? []) {
      const rawId = (service as { id?: number | string }).id;
      if (rawId === undefined || rawId === null) continue;
      const value = typeof rawId === 'number' ? rawId : Number(rawId);
      if (Number.isFinite(value)) {
        ids.push(value);
      }
    }
    ids.sort((a, b) => a - b);
    return ids;
  }

  private formatClient(client: ClientRow): ClientDtoWithServices {
    const dto = parseEntityView(clientContract.view, client);
    const serviceIds = this.extractServiceIds(client);
    return { ...dto, serviceIds };
  }

  private async fetchClientById(session: OrmSession, id: number | string): Promise<ClientDtoWithServices> {
    const rows = await this.baseClientQuery()
      .where(eq(this.table.columns.id, id))
      .execute(session);
    const client = rows[0];
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    return this.formatClient(client);
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
    response: ClientListResponse,
  })
  async list(): Promise<ClientDtoWithServices[]> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = await this.baseClientQuery()
        .orderBy(this.table.columns.id, 'ASC')
        .execute(session);
      return rows.map((row) => this.formatClient(row));
    });
  }

  @Get('/count', {
    query: EmptyQuery,
    response: CountResponse,
  })
  async count(): Promise<{ count: number }> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = (await selectFromEntity(Client)
        .select({ count: count(this.table.columns.id) })
        .execute(session)) as Array<{ count?: number | string | null }>;
      const value = rows[0]?.count;
      return { count: typeof value === 'number' ? value : Number(value ?? 0) };
    });
  }

  @Get('/search', {
    query: SearchQuery,
    response: ClientListResponse,
  })
  async search(ctx: ClientSearchCtx): Promise<ClientDtoWithServices[]> {
    await this.ready;
    const input = ctx.input.query;
    return this.withSession(async (session) => {
      let queryBuilder = this.baseClientQuery().orderBy(this.table.columns.id, 'ASC');
      const condition = this.buildSearchCondition(input);
      if (condition) {
        queryBuilder = queryBuilder.where(condition);
      }
      const rows = await queryBuilder.execute(session);
      return Promise.all(rows.map((row) => this.formatClient(row)));
    });
  }

  @Get('/{id}', {
    params: ClientParams,
    query: EmptyQuery,
    response: ClientResponse,
  })
  async get(ctx: ClientParamsCtx): Promise<ClientDtoWithServices> {
    await this.ready;
    const { id } = ctx.input.params;
    return this.withSession(async (session) => {
      return this.fetchClientById(session, id);
    });
  }

  @Post('/', {
    query: EmptyQuery,
    body: CreateClientBody,
    response: ClientResponse,
  })
  async create(ctx: ClientCreateCtx): Promise<ClientDtoWithServices> {
    await this.ready;
    const body = ctx.input.body;
    return this.withSession(async (session) => {
      const payload: Record<string, unknown> = {
        name: body.name,
        email: body.email ?? null,
      };
      if (body.serviceIds !== undefined) {
        payload.services = body.serviceIds;
      }
      const client = await session.saveGraph(Client, payload, {
        pruneMissing: body.serviceIds !== undefined,
      });
      const persistedId = (client as unknown as { id?: number | string }).id;
      if (persistedId === undefined || persistedId === null) {
        throw new NotFoundError('Client not found');
      }
      return this.fetchClientById(session, persistedId as number | string);
    });
  }

  @Put('/{id}', {
    params: ClientParams,
    query: EmptyQuery,
    body: UpdateClientBody,
    response: ClientResponse,
  })
  async update(ctx: ClientUpdateCtx): Promise<ClientDtoWithServices> {
    await this.ready;
    const { id } = ctx.input.params;
    const body = ctx.input.body;
    return this.withSession(async (session) => {
      const client = await session.find(Client, id);
      if (!client) {
        throw new NotFoundError('Client not found');
      }
      if (body.name !== undefined) {
        client.name = body.name;
      }
      if (body.email !== undefined) {
        client.email = body.email;
      }
      if (body.serviceIds !== undefined) {
        await client.services.syncByIds(body.serviceIds);
      }
      await session.commit();
      return this.fetchClientById(session, id);
    });
  }

  @Delete('/{id}', {
    params: ClientParams,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async remove(ctx: ClientRemoveCtx): Promise<void> {
    await this.ready;
    const { id } = ctx.input.params;
    return this.withSession(async (session) => {
      const client = await session.find(Client, id);
      if (!client) {
        throw new NotFoundError('Client not found');
      }
      await session.remove(client);
      await session.commit();
    });
  }
}
