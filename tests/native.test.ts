import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  Controller,
  Get,
  Post,
  Body,
  Params,
  Query,
  Returns,
  t,
  createNativeApp,
  shutdownNativeApp,
  type NativeRequestContext
} from "../src";

@Controller("/test")
class TestController {
  @Get("/hello")
  async hello() {
    return { message: "hello" };
  }

  @Post("/echo")
  @Body(t.object({ name: t.string() }))
  async echo(ctx: NativeRequestContext<{ name: string }>) {
    return { hello: ctx.body.name };
  }

  @Get("/greet/:name")
  @Params(t.object({ name: t.string() }))
  async greet(ctx: NativeRequestContext<any, any, { name: string }>) {
    return { message: `Hello, ${ctx.params.name}!` };
  }

  @Get("/query")
  @Query(t.object({ q: t.string() }))
  async query(ctx: NativeRequestContext<any, { q: string }>) {
    return { result: ctx.query.q };
  }
}

describe("Native Adapter", () => {
  let app: any;

  beforeEach(async () => {
    app = await createNativeApp({
      controllers: [TestController]
    });
  });

  afterEach(async () => {
    await shutdownNativeApp();
  });

  it("should handle GET request", async () => {
    const req: any = {
      method: "GET",
      url: "/test/hello",
      headers: {}
    };
    const res: any = {
      statusCode: 0,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      getHeader(name: string) {
        return this.headers[name];
      },
      end: (data: string) => {
        res.body = data;
      }
    };

    await app.handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ message: "hello" });
  });

  it("should handle POST request with body", async () => {
    const req: any = {
      method: "POST",
      url: "/test/echo",
      headers: { "content-type": "application/json" },
      on: (event: string, cb: any) => {
        if (event === "data") {
          cb(JSON.stringify({ name: "World" }));
        }
        if (event === "end") {
          cb();
        }
      }
    };
    const res: any = {
      statusCode: 0,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      getHeader(name: string) {
        return this.headers[name];
      },
      end: (data: string) => {
        res.body = data;
      }
    };

    await app.handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ hello: "World" });
  });

  it("should handle path parameters", async () => {
    const req: any = {
      method: "GET",
      url: "/test/greet/John",
      headers: {}
    };
    const res: any = {
      statusCode: 0,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      getHeader(name: string) {
        return this.headers[name];
      },
      end: (data: string) => {
        res.body = data;
      }
    };

    await app.handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ message: "Hello, John!" });
  });

  it("should handle query parameters", async () => {
    const req: any = {
      method: "GET",
      url: "/test/query?q=search",
      headers: {}
    };
    const res: any = {
      statusCode: 0,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      getHeader(name: string) {
        return this.headers[name];
      },
      end: (data: string) => {
        res.body = data;
      }
    };

    await app.handle(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ result: "search" });
  });

  it("should return 404 for unknown route", async () => {
    const req: any = {
      method: "GET",
      url: "/unknown",
      headers: {}
    };
    const res: any = {
      statusCode: 0,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      getHeader(name: string) {
        return this.headers[name];
      },
      end: (data: string) => {
        res.body = data;
      }
    };

    await app.handle(req, res);

    expect(res.statusCode).toBe(404);
  });
});
