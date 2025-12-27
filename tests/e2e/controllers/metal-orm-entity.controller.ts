import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  EmptyResponse,
  NotFoundError,
  simpleSchemaProvider,
  buildEntitySchemaShapes,
  defineEntityApi,
  coerceEntityId,
  extractEntityDtos,
} from '../../../src/index.js';
import type { InferApiTypes, RequireDefined } from '../../../src/index.js';
import {
  Entity,
  Column,
  PrimaryKey,
  BelongsToMany,
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  selectFromEntity,
  entityRef,
  esel,
  count,
  eq,
  and,
  col,
  bootstrapEntities,
} from 'metal-orm';
import type { ColumnDef, ExpressionNode, OrmSession, ManyToManyCollection } from 'metal-orm';
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

const schema = simpleSchemaProvider;

const baseId = 'MetalOrmEntityClient';

const schemaId = (suffix: string) => `${baseId}${suffix}`;

const intNumber = schema.int!(schema.number());
const nameSchema = schema.minLength!(schema.string(), 1);
const emailSchema = schema.email!(schema.string());
const serviceIdsSchema = schema.array(intNumber);
const serviceShapes = buildEntitySchemaShapes({
  target: Service,
  provider: schema,
  select: ['id', 'name'],
  responseOptional: false,
  responseNullable: false,
});
const ServicesSchema = schema.array(schema.object(serviceShapes.response));

const clientShapes = buildEntitySchemaShapes({
  target: Client,
  provider: schema,
  select: ['id', 'name', 'email', 'createdAt'],
  create: ['name', 'email'],
  update: ['name', 'email'],
  search: ['name', 'email'],
  responseOptional: false,
  responseNullable: false,
  overrides: {
    response: {
      email: schema.nullable(emailSchema),
      createdAt: schema.string(),
    },
    create: {
      name: nameSchema,
      email: emailSchema,
    },
    update: {
      name: schema.optional(nameSchema),
      email: schema.nullable(emailSchema),
    },
    search: {
      name: nameSchema,
      email: emailSchema,
    },
  },
  extras: {
    response: { services: ServicesSchema },
    create: { serviceIds: schema.optional(serviceIdsSchema) },
    update: { serviceIds: schema.optional(serviceIdsSchema) },
  },
});

type ServiceDto = Pick<Service, 'id' | 'name'>;
type ClientDtoWithServices = RequireDefined<
  Pick<Client, 'id' | 'name' | 'email' | 'createdAt'>,
  'email' | 'createdAt'
> & { services: ServiceDto[] };
type ClientCreateBody = Pick<Client, 'name' | 'email'> & { serviceIds?: number[] };
type ClientUpdateBody = Partial<Pick<Client, 'name' | 'email'>> & { serviceIds?: number[] };
type ClientSearchQuery = Partial<Record<'name' | 'email', string>>;
type ClientApiTypeHints = {
  params: Pick<Client, 'id'>;
  response: ClientDtoWithServices;
  create: ClientCreateBody;
  update: ClientUpdateBody;
  search: ClientSearchQuery;
};

const ClientInsightsResponse = schema.toSchemaRef<{
  totalClients: number;
  totalServiceLinks: number;
  averageServicesPerClient: number;
  topClients: Array<{ id: number; name: string; serviceCount: number }>;
}>(
  schemaId('InsightsResponse'),
  schema.object({
    totalClients: intNumber,
    totalServiceLinks: intNumber,
    averageServicesPerClient: schema.number(),
    topClients: schema.array(
      schema.object({
        id: intNumber,
        name: schema.string(),
        serviceCount: intNumber,
      })
    ),
  })
);

const ClientApi = defineEntityApi({
  baseId,
  provider: schema,
  shapes: clientShapes,
  schemaId,
  extras: {
    insights: ClientInsightsResponse,
  },
  types: {} as ClientApiTypeHints,
});
type ClientApiTypes = InferApiTypes<typeof ClientApi>;
type ClientInsights = ClientApiTypes['DTO']['insights'];
type ClientParamsCtx = ClientApiTypes['Context']['Get'];
type ClientSearchCtx = ClientApiTypes['Context']['Search'];
type ClientCreateCtx = ClientApiTypes['Context']['Create'];
type ClientUpdateCtx = ClientApiTypes['Context']['Update'];
type ClientRemoveCtx = ClientApiTypes['Context']['Remove'];
type ClientRow = {
  id: number | string;
  name: string;
  email?: string | null;
  createdAt?: string | null;
  services?: ManyToManyCollection<Record<string, unknown>, object | undefined>;
};

@Controller('/metal-orm-entity-clients')
export class MetalOrmEntityClientsController {
  private readonly db: sqlite3.Database;
  private readonly sqliteClient: SqlitePromiseClient;
  protected readonly orm: Orm;
  protected readonly ready: Promise<void>;
  private readonly selection = esel(Client, 'id', 'name', 'email', 'createdAt');
  private readonly clientRef = entityRef(Client);
  private readonly searchFields: ReadonlyArray<'name' | 'email'> = ['name', 'email'];

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
      [now, now]
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
      .select(this.selection)
      .include('services', { columns: ['id', 'name'] });
  }

  private extractServices(client: ClientRow): ServiceDto[] {
    const dtos = extractEntityDtos(Service, client.services, ['id', 'name'] as const);
    dtos.sort((a, b) => a.id - b.id);
    return dtos;
  }

  private getColumnDef(field: string): ColumnDef | undefined {
    return (this.clientRef.$ as Record<string, ColumnDef>)[field];
  }

  private formatClient(client: ClientRow): ClientDtoWithServices {
    const id = coerceEntityId(Client, client.id) ?? 0;
    const emailValue = client.email ?? null;
    const createdAtValue = client.createdAt ?? null;
    return {
      id,
      name: client.name,
      email: typeof emailValue === 'string' ? emailValue : (emailValue ?? null),
      createdAt: typeof createdAtValue === 'string' ? createdAtValue : '',
      services: this.extractServices(client),
    };
  }

  private async fetchClientById(
    session: OrmSession,
    id: number
  ): Promise<ClientDtoWithServices> {
    const rows = await this.baseClientQuery().where(eq(this.clientRef.id, id)).execute(session);
    const client = rows[0];
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    return this.formatClient(client);
  }

  private fetchFreshClient(id: number): Promise<ClientDtoWithServices> {
    return this.withSession((session) => this.fetchClientById(session, id));
  }

  private buildSearchCondition(input: Record<string, unknown>): ExpressionNode | undefined {
    let condition: ExpressionNode | undefined;
    for (const field of this.searchFields) {
      const value = input[field];
      if (value === undefined || value === null || value === '') continue;
      const column = this.getColumnDef(field);
      if (!column) continue;
      const next = eq(column, value as string | number | boolean);
      condition = condition ? and(condition, next) : next;
    }
    return condition;
  }

  @Get('/', {
    query: ClientApi.emptyQuery,
    response: ClientApi.list,
  })
  async list(): Promise<ClientDtoWithServices[]> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = await this.baseClientQuery().orderBy(this.clientRef.id, 'ASC').execute(session);
      return rows.map((row) => this.formatClient(row));
    });
  }

  @Get('/count', {
    query: ClientApi.emptyQuery,
    response: ClientApi.count,
  })
  async count(): Promise<{ count: number }> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = (await selectFromEntity(Client)
        .select({ count: count(this.clientRef.id) })
        .execute(session)) as Array<{ count?: number | string | null }>;
      const value = rows[0]?.count;
      return { count: typeof value === 'number' ? value : Number(value ?? 0) };
    });
  }

  @Get('/search', {
    query: ClientApi.search,
    response: ClientApi.list,
  })
  async search(ctx: ClientSearchCtx): Promise<ClientDtoWithServices[]> {
    await this.ready;
    const input = ctx.input.query;
    return this.withSession(async (session) => {
      let queryBuilder = this.baseClientQuery().orderBy(this.clientRef.id, 'ASC');
      const condition = this.buildSearchCondition(input);
      if (condition) {
        queryBuilder = queryBuilder.where(condition);
      }
      const rows = await queryBuilder.execute(session);
      return Promise.all(rows.map((row) => this.formatClient(row)));
    });
  }

  @Get('/insights', {
    query: ClientApi.emptyQuery,
    response: ClientApi.insights,
  })
  async insights(): Promise<ClientInsights> {
    await this.ready;
    return this.withSession(async (session) => {
      const rows = await this.baseClientQuery().orderBy(this.clientRef.id, 'ASC').execute(session);
      const clients = rows.map((row) => this.formatClient(row));
      let totalServiceLinks = 0;
      const topClients = clients.map((client) => {
        const serviceCount = client.services.length;
        totalServiceLinks += serviceCount;
        const idValue = typeof client.id === 'number' ? client.id : Number(client.id);
        return {
          id: Number.isFinite(idValue) ? idValue : 0,
          name: client.name,
          serviceCount,
        };
      });
      topClients.sort((a, b) => {
        if (b.serviceCount !== a.serviceCount) return b.serviceCount - a.serviceCount;
        return a.name.localeCompare(b.name);
      });

      const totalClients = clients.length;
      return {
        totalClients,
        totalServiceLinks,
        averageServicesPerClient: totalClients === 0 ? 0 : totalServiceLinks / totalClients,
        topClients: topClients.slice(0, 3),
      };
    });
  }

  @Get('/{id}', {
    params: ClientApi.params,
    query: ClientApi.emptyQuery,
    response: ClientApi.response,
  })
  async get(ctx: ClientParamsCtx): Promise<ClientDtoWithServices> {
    await this.ready;
    const { id } = ctx.input.params;
    return this.withSession(async (session) => {
      return this.fetchClientById(session, id);
    });
  }

  @Post('/', {
    query: ClientApi.emptyQuery,
    body: ClientApi.create,
    response: ClientApi.response,
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
      const id = coerceEntityId(Client, persistedId);
      if (id === undefined) {
        throw new NotFoundError('Client not found');
      }
      await session.commit();
      return this.fetchFreshClient(id);
    });
  }

  @Put('/{id}', {
    params: ClientApi.params,
    query: ClientApi.emptyQuery,
    body: ClientApi.update,
    response: ClientApi.response,
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
      return this.fetchFreshClient(id);
    });
  }

  @Delete('/{id}', {
    params: ClientApi.params,
    query: ClientApi.emptyQuery,
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
