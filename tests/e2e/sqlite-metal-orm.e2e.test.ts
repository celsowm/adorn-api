import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import sqlite3 from "sqlite3";
import {
  Body,
  Controller,
  Dto,
  Field,
  Get,
  Post,
  Returns,
  createExpressApp,
  t,
  type RequestContext
} from "../../src/index";
import {
  SqliteDialect,
  Orm,
  col,
  createSqliteExecutor,
  defineTable,
  selectFrom,
  type SqliteClientLike
} from "metal-orm";

const users = defineTable("users", {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.text())
});

let db: sqlite3.Database | null = null;
let orm: Orm | null = null;

function createSqliteClient(database: sqlite3.Database): SqliteClientLike {
  return {
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows as Record<string, unknown>[]);
        });
      });
    }
  };
}

function execSql(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function closeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function createSession() {
  if (!orm) {
    throw new Error("ORM not initialized");
  }
  return orm.createSession();
}

@Dto()
class CreateUserDto {
  @Field(t.string({ minLength: 1 }))
  name!: string;
}

@Dto()
class UserDto {
  @Field(t.integer())
  id!: number;

  @Field(t.string({ minLength: 1 }))
  name!: string;
}

@Controller("/users")
class UserController {
  @Get("/")
  @Returns(t.array(t.ref(UserDto)))
  async list() {
    const session = createSession();
    try {
      return await selectFrom(users)
        .select("id", "name")
        .orderBy(users.columns.id, "ASC")
        .executePlain(session);
    } finally {
      await session.dispose();
    }
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  async create(ctx: RequestContext<CreateUserDto>) {
    const session = createSession();
    try {
      const user = { name: ctx.body.name };
      session.trackNew(users, user);
      await session.commit();
      return user as UserDto;
    } finally {
      await session.dispose();
    }
  }
}

describe("e2e sqlite memory (metal-orm)", () => {
  let app: Awaited<ReturnType<typeof createExpressApp>>;

  beforeAll(async () => {
    db = new sqlite3.Database(":memory:");
    await execSql("create table users (id integer primary key autoincrement, name text not null)");

    const client = createSqliteClient(db);
    const executor = createSqliteExecutor(client);
    orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {}
      }
    });
    app = await createExpressApp({ controllers: [UserController] });
  });

  afterAll(async () => {
    await orm?.dispose();
    await closeDb();
  });

  it("creates and lists users", async () => {
    const createResponse = await request(app)
      .post("/users")
      .send({ name: "Ada" })
      .expect(201);

    expect(createResponse.body).toMatchObject({ id: 1, name: "Ada" });

    const listResponse = await request(app)
      .get("/users")
      .expect(200);

    expect(listResponse.body).toEqual([{ id: 1, name: "Ada" }]);
  });
});
