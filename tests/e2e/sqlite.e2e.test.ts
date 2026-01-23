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

let db: sqlite3.Database;

function run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row as T | undefined);
    });
  });
}

function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows as T[]);
    });
  });
}

function closeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
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
    return all<UserDto>("select id, name from users order by id asc");
  }

  @Post("/")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: UserDto })
  async create(ctx: RequestContext<CreateUserDto>) {
    const result = await run("insert into users (name) values (?)", [ctx.body.name]);
    const row = await get<UserDto>("select id, name from users where id = ?", [result.lastID]);
    return row!;
  }
}

describe("e2e sqlite memory", () => {
  const app = createExpressApp({ controllers: [UserController] });

  beforeAll(async () => {
    db = new sqlite3.Database(":memory:");
    await run("create table users (id integer primary key autoincrement, name text not null)");
  });

  afterAll(async () => {
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
