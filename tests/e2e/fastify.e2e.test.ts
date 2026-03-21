import { describe, it, expect, beforeAll } from "vitest";
import { createFastifyApp } from "../../src";
import { Controller, Get, Post, Body, Params, Query, t, type RequestContext, Auth, Roles, Sse } from "../../src";

@Controller("/test")
class TestController {
  @Get("/hello")
  hello() {
    return { message: "Hello from Fastify" };
  }

  @Post("/echo")
  @Body(t.object({ name: t.string() }))
  echo(ctx: RequestContext<{ name: string }>) {
    return { name: ctx.body.name };
  }

  @Get("/params/:id")
  @Params(t.object({ id: t.string() }))
  getParam(ctx: RequestContext<any, any, { id: string }>) {
    return { id: ctx.params.id };
  }

  @Get("/query")
  @Query(t.object({ q: t.string() }))
  getQuery(ctx: RequestContext<any, { q: string }>) {
    return { q: ctx.query.q };
  }

  @Get("/protected")
  @Auth()
  protected() {
    return { message: "Authenticated" };
  }

  @Get("/roles")
  @Roles("admin")
  roles() {
    return { message: "Admin only" };
  }

  @Get("/sse")
  @Sse()
  sse(ctx: RequestContext) {
    ctx.sse?.send({ message: "Hello SSE" });
    ctx.sse?.close();
  }
}

describe("Fastify Adapter E2E", () => {
  let app: any;

  beforeAll(async () => {
    app = await createFastifyApp({
      controllers: [TestController]
    });
    await app.ready();
  });

  it("should handle GET /hello", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/hello"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Hello from Fastify" });
  });

  it("should handle POST /echo with body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/test/echo",
      payload: { name: "Adorn" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: "Adorn" });
  });

  it("should handle GET /params/:id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/params/123"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: "123" });
  });

  it("should handle GET /query", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/query?q=search"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ q: "search" });
  });

  it("should handle validation errors", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/test/echo",
      payload: { name: 123 } // Invalid type
    });

    expect(response.statusCode).toBe(400);
  });

  it("should block unauthorized access to protected route", async () => {
    const app401 = await createFastifyApp({
      controllers: [TestController]
    });
    const response = await app401.inject({
      method: "GET",
      url: "/test/protected"
    });

    console.log("401 response body:", response.body);
    expect(response.statusCode).toBe(401);
  });

  it("should allow authorized access to protected route", async () => {
    const appAuth = await createFastifyApp({
      controllers: [TestController]
    });
    appAuth.addHook("preHandler", async (req: any, _reply: any) => {
      req.user = { id: "1" };
    });

    const response = await appAuth.inject({
      method: "GET",
      url: "/test/protected"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Authenticated" });
  });

  it("should block access without required role", async () => {
    const appNoRole = await createFastifyApp({
      controllers: [TestController]
    });
    appNoRole.addHook("preHandler", async (req: any, _reply: any) => {
      req.user = { id: "1", roles: ["user"] };
    });
    const response = await appNoRole.inject({
      method: "GET",
      url: "/test/roles"
    });

    expect(response.statusCode).toBe(403);
  });

  it("should allow access with required role", async () => {
    // Overriding user with admin role
    const appWithAdmin = await createFastifyApp({
      controllers: [TestController]
    });
    appWithAdmin.addHook("preHandler", async (req: any) => {
      req.user = { id: "1", roles: ["admin"] };
    });

    const response = await appWithAdmin.inject({
      method: "GET",
      url: "/test/roles"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Admin only" });
  });

});
