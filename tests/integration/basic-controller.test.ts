import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  Controller,
  Get,
  Post,
  ExpressAdapter,
  type HttpContext,
} from "../../src/index.js";

describe("Integration: Basic Controller", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    app = null as any;
  });

  it("should register and call GET route", async () => {
    @Controller("/test")
    class TestController {
      @Get("/hello")
      hello() {
        return { message: "Hello World" };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(TestController);

    const response = await request(app).get("/test/hello");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Hello World" });
  });

  it("should register and call POST route", async () => {
    @Controller("/test")
    class TestController {
      @Post("/echo")
      echo(ctx: HttpContext) {
        return { data: ctx.req.body };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(TestController);

    const response = await request(app)
      .post("/test/echo")
      .send({ test: "data" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { test: "data" } });
  });

  it("should handle multiple routes", async () => {
    @Controller("/multi")
    class MultiController {
      @Get("/")
      getAll() {
        return [{ id: 1 }, { id: 2 }];
      }

      @Get("/:id")
      getById(ctx: HttpContext) {
        return { id: ctx.params.param("id") };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(MultiController);

    const getAllResponse = await request(app).get("/multi/");
    expect(getAllResponse.status).toBe(200);
    expect(getAllResponse.body).toHaveLength(2);

    const getByIdResponse = await request(app).get("/multi/123");
    expect(getByIdResponse.status).toBe(200);
    expect(getByIdResponse.body).toEqual({ id: "123" });
  });
});
