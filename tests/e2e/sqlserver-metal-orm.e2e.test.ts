import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Connection, Request, TYPES } from "tedious";
import {
  Column,
  Entity,
  Orm,
  PrimaryKey,
  SqlServerDialect,
  col,
  createTediousExecutor,
  entityRef,
  selectFromEntity
} from "metal-orm";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpError,
  Params,
  Patch,
  Post,
  Put,
  Returns,
  buildOpenApi,
  createMetalCrudDtoClasses,
  t,
  type RequestContext
} from "../../src/index";

let connection: Connection | null = null;
let orm: Orm | null = null;

function ensureOrm(): Orm {
  if (!orm) {
    throw new Error("ORM not initialized");
  }
  return orm;
}

function createSession() {
  return ensureOrm().createSession();
}

type OrmSession = ReturnType<typeof createSession>;

async function withSession<T>(handler: (session: OrmSession) => Promise<T>): Promise<T> {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

@Entity({ tableName: "nota_versao" })
class NotaVersao {
  @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
  id!: number;

  @Column(col.notNull(col.date<Date>()))
  data!: Date;

  @Column(col.notNull(col.int()))
  sprint!: number;

  @Column(col.notNull(col.boolean()))
  ativo!: boolean;

  @Column(col.notNull(col.text()))
  mensagem!: string;

  @Column(col.datetime<Date>())
  data_exclusao?: Date;

  @Column(col.datetime<Date>())
  data_inativacao?: Date;
}

const notaVersaoCrud = createMetalCrudDtoClasses(NotaVersao, {
  mutationExclude: ["id", "data_exclusao", "data_inativacao"]
});

const {
  response: NotaVersaoDto,
  create: CreateNotaVersaoDto,
  replace: ReplaceNotaVersaoDto,
  update: UpdateNotaVersaoDto,
  params: NotaVersaoParamsDto
} = notaVersaoCrud;

const notaVersaoRef = entityRef(NotaVersao);

type CreateNotaVersaoDtoType = InstanceType<typeof CreateNotaVersaoDto>;
type ReplaceNotaVersaoDtoType = InstanceType<typeof ReplaceNotaVersaoDto>;
type UpdateNotaVersaoDtoType = InstanceType<typeof UpdateNotaVersaoDto>;
type NotaVersaoParams = InstanceType<typeof NotaVersaoParamsDto>;

function parseNotaVersaoId(value: unknown): number {
  const provided =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isInteger(provided) || provided < 1) {
    throw new HttpError(400, "Invalid nota de versão identifier.");
  }
  return provided;
}

function parseNotaVersaoDate(value: string | Date): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid date for nota de versão.");
  }
  return parsed;
}

async function getNotaVersaoOrThrow(session: OrmSession, id: number): Promise<NotaVersao> {
  const entity = (await session.find(NotaVersao, id)) as NotaVersao | null;
  if (!entity) {
    throw new HttpError(404, "Nota de versão não encontrada.");
  }
  return entity;
}

@Controller("/nota-versao")
class NotaVersaoController {
  @Get("/")
  @Returns(t.array(t.ref(NotaVersaoDto)))
  async list(): Promise<NotaVersao[]> {
    return withSession(async (session) => {
      const rows = await selectFromEntity(NotaVersao)
        .orderBy(notaVersaoRef.id, "ASC")
        .execute(session);
      return rows as NotaVersao[];
    });
  }

  @Post("/")
  @Body(CreateNotaVersaoDto)
  @Returns({ status: 201, schema: NotaVersaoDto })
  async create(ctx: RequestContext<CreateNotaVersaoDtoType>): Promise<NotaVersao> {
    return withSession(async (session) => {
      const parsedData = parseNotaVersaoDate(ctx.body.data);
      const nota = new NotaVersao();
      const dbDate = parsedData.toISOString();
      (nota as any).data = dbDate;
      nota.sprint = ctx.body.sprint;
      nota.ativo = ctx.body.ativo;
      nota.mensagem = ctx.body.mensagem;
      await session.persist(nota);
      await session.commit();
      nota.data = parsedData;
      return nota;
    });
  }

  @Get("/:id")
  @Params(NotaVersaoParamsDto)
  @Returns(t.ref(NotaVersaoDto))
  async getById(ctx: RequestContext<unknown, undefined, NotaVersaoParams>) {
    const id = parseNotaVersaoId(ctx.params.id);
    return withSession(async (session) => getNotaVersaoOrThrow(session, id));
  }

  @Put("/:id")
  @Params(NotaVersaoParamsDto)
  @Body(ReplaceNotaVersaoDto)
  @Returns(t.ref(NotaVersaoDto))
  async replace(ctx: RequestContext<ReplaceNotaVersaoDtoType, undefined, NotaVersaoParams>) {
    const id = parseNotaVersaoId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getNotaVersaoOrThrow(session, id);
      const parsedData = parseNotaVersaoDate(ctx.body.data);
      const dbDate = parsedData.toISOString();
      (entity as any).data = dbDate;
      entity.sprint = ctx.body.sprint;
      entity.ativo = ctx.body.ativo;
      entity.mensagem = ctx.body.mensagem;
      await session.commit();
      entity.data = parsedData;
      return entity;
    });
  }

  @Patch("/:id")
  @Params(NotaVersaoParamsDto)
  @Body(UpdateNotaVersaoDto)
  @Returns(t.ref(NotaVersaoDto))
  async update(ctx: RequestContext<UpdateNotaVersaoDtoType, undefined, NotaVersaoParams>) {
    const id = parseNotaVersaoId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getNotaVersaoOrThrow(session, id);
      let parsedData: Date | undefined;
      if (ctx.body.data !== undefined) {
        parsedData = parseNotaVersaoDate(ctx.body.data);
        (entity as any).data = parsedData.toISOString();
      }
      if (ctx.body.sprint !== undefined) {
        entity.sprint = ctx.body.sprint;
      }
      if (ctx.body.ativo !== undefined) {
        entity.ativo = ctx.body.ativo;
      }
      if (ctx.body.mensagem !== undefined) {
        entity.mensagem = ctx.body.mensagem;
      }
      await session.commit();
      if (parsedData) {
        entity.data = parsedData;
      }
      return entity;
    });
  }

  @Delete("/:id")
  @Params(NotaVersaoParamsDto)
  @Returns({ status: 204 })
  async remove(ctx: RequestContext<unknown, undefined, NotaVersaoParams>) {
    const id = parseNotaVersaoId(ctx.params.id);
    return withSession(async (session) => {
      const entity = await getNotaVersaoOrThrow(session, id);
      await session.remove(entity);
      await session.commit();
    });
  }
}

const sqlEnv = {
  host: process.env.PGE_DIGITAL_HOST,
  user: process.env.PGE_DIGITAL_USER,
  password: process.env.PGE_DIGITAL_PASSWORD,
  encrypt: process.env.PGE_DIGITAL_ENCRYPT,
  trustCert: process.env.PGE_DIGITAL_TRUST_CERT,
  database: process.env.PGE_DIGITAL_DATABASE
};

const hasSqlEnv = Boolean(sqlEnv.host && sqlEnv.user && sqlEnv.password && sqlEnv.database);
const describeSqlServer = hasSqlEnv ? describe : describe.skip;

function buildTestContext<
  TBody = undefined,
  TQuery extends object | undefined = undefined,
  TParams extends object | undefined = Record<string, string | number | boolean | undefined>
>(options: { body?: TBody; query?: TQuery; params?: TParams } = {}): RequestContext<
  TBody,
  TQuery,
  TParams
> {
  const params = (options.params ?? ({} as TParams)) as TParams;
  const query = (options.query ?? (undefined as TQuery)) as TQuery;
  return {
    req: {} as any,
    res: {} as any,
    body: options.body as TBody,
    query,
    params,
    headers: {},
    files: undefined
  };
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return undefined;
}

function parseServer(value: string): { server: string; port?: number; instanceName?: string } {
  const [serverPart, instancePart] = value.split("\\");
  let server = serverPart;
  let port: number | undefined;
  if (serverPart.includes(":")) {
    const [host, portValue] = serverPart.split(":");
    server = host;
    const parsed = Number(portValue);
    if (Number.isFinite(parsed)) {
      port = parsed;
    }
  }
  return {
    server,
    port,
    instanceName: instancePart || undefined
  };
}

async function openConnection(): Promise<Connection> {
  if (!sqlEnv.host || !sqlEnv.user || !sqlEnv.password || !sqlEnv.database) {
    throw new Error("Missing SQL Server env vars.");
  }

  const { server, port, instanceName } = parseServer(sqlEnv.host);
  const encrypt = parseBoolean(sqlEnv.encrypt);
  const trustServerCertificate = parseBoolean(sqlEnv.trustCert);

  const options: Record<string, unknown> = {
    database: sqlEnv.database
  };
  if (port !== undefined) {
    options.port = port;
  }
  if (instanceName) {
    options.instanceName = instanceName;
  }
  if (encrypt !== undefined) {
    options.encrypt = encrypt;
  }
  if (trustServerCertificate !== undefined) {
    options.trustServerCertificate = trustServerCertificate;
  }

  const connection = new Connection({
    server,
    authentication: {
      type: "default",
      options: {
        userName: sqlEnv.user,
        password: sqlEnv.password
      }
    },
    options
  });

  await new Promise<void>((resolve, reject) => {
    const onConnect = (err?: Error) => {
      connection.removeListener("error", onError);
      if (err) {
        reject(err);
        return;
      }
      resolve();
    };
    const onError = (err: Error) => {
      connection.removeListener("connect", onConnect);
      reject(err);
    };
    connection.once("connect", onConnect);
    connection.once("error", onError);
    connection.connect();
  });

  return connection;
}

async function closeConnection(connection: Connection | null): Promise<void> {
  if (!connection) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const onEnd = () => {
      connection.removeListener("error", onError);
      resolve();
    };
    const onError = (err: Error) => {
      connection.removeListener("end", onEnd);
      reject(err);
    };
    connection.once("end", onEnd);
    connection.once("error", onError);
    connection.close();
  });
}

describeSqlServer("e2e sqlserver (metal-orm)", () => {

  beforeAll(async () => {
    connection = await openConnection();
    const executor = createTediousExecutor(connection, { Request, TYPES });
    orm = new Orm({
      dialect: new SqlServerDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {}
      }
    });
  });

  afterAll(async () => {
    await orm?.dispose();
    await closeConnection(connection);
    orm = null;
    connection = null;
  });

  it("list controller retrieves rows from SQL Server", async () => {
    const controller = new NotaVersaoController();
    const rows = await controller.list();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("performs the full CRUD cycle against SQL Server", async () => {
    const controller = new NotaVersaoController();
    const createPayload = {
      data: new Date(),
      sprint: 999,
      ativo: true,
      mensagem: `E2E CRUD ${Date.now()}`
    } satisfies CreateNotaVersaoDtoType;

    const created = await controller.create(buildTestContext({ body: createPayload }));
    expect(created.mensagem).toBe(createPayload.mensagem);

    const rows = await controller.list();
    const createdRow = rows.find(
      (row) => row.mensagem === createPayload.mensagem && row.sprint === createPayload.sprint
    );
    if (!createdRow) {
      throw new Error("Created nota de versão not found in list");
    }
    expect(createdRow.id).toBeGreaterThan(0);

    const replacePayload = {
      data: new Date(createdRow.data.getTime() + 1000),
      sprint: createPayload.sprint + 1,
      ativo: !createPayload.ativo,
      mensagem: `${createPayload.mensagem} (replaced)`
    } satisfies ReplaceNotaVersaoDtoType;

    const replaced = await controller.replace(
      buildTestContext({ body: replacePayload, params: { id: createdRow.id } })
    );
    expect(replaced.id).toBe(createdRow.id);
    expect(replaced.sprint).toBe(replacePayload.sprint);
    expect(replaced.ativo).toBe(replacePayload.ativo);

    const updatePayload = {
      mensagem: `${replacePayload.mensagem} (patched)`
    } satisfies UpdateNotaVersaoDtoType;

    const patched = await controller.update(
      buildTestContext({ body: updatePayload, params: { id: createdRow.id } })
    );
    expect(patched.id).toBe(createdRow.id);
    expect(patched.mensagem).toBe(updatePayload.mensagem);

    await controller.remove(buildTestContext({ params: { id: createdRow.id } }));

    await expect(
      controller.getById(buildTestContext({ params: { id: createdRow.id } }))
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("builds OpenAPI schemas with date formats", () => {
    const doc = buildOpenApi({
      info: { title: "SQL Server API", version: "1.0.0" },
      controllers: [NotaVersaoController]
    });

    const schemas = doc.components.schemas as Record<string, any>;
    const notaVersaoDto = schemas.NotaVersaoDto;
    expect(notaVersaoDto).toBeDefined();

    const props = notaVersaoDto.properties as Record<string, any>;
    expect(props.data.format).toBe("date");
    expect(props.data_exclusao.format).toBe("date-time");
    expect(props.data_inativacao.format).toBe("date-time");

    const createDto = schemas.CreateNotaVersaoDto;
    expect(createDto).toBeDefined();
    const createProps = createDto.properties as Record<string, any>;
    expect(createProps.data.format).toBe("date");
  });
});
