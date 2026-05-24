import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  Auth,
  Controller,
  Get,
  Public,
  Roles,
  createExpressApp,
  createFastifyApp,
  createNativeApp,
  shutdownNativeApp,
  type AuthUser
} from "../../src";

@Controller("/bearer")
class BearerController {
  @Get("/public")
  @Public()
  public() {
    return { message: "public" };
  }

  @Get("/protected")
  @Auth()
  protected() {
    return { message: "protected" };
  }

  @Get("/admin")
  @Roles("admin")
  admin() {
    return { message: "admin" };
  }
}

function verifyToken(token: string): AuthUser | null {
  if (token === "valid") {
    return { id: "1", roles: ["user"] };
  }
  if (token === "admin") {
    return { id: "2", roles: ["admin"] };
  }
  return null;
}

function createMockNativeRequest(path: string, token?: string): any {
  return {
    method: "GET",
    url: path,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };
}

function createMockNativeResponse(): any {
  const res: any = {
    statusCode: 0,
    headers: {},
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    getHeader(name: string) {
      return this.headers[name];
    },
    end(data: string) {
      this.body = data;
    }
  };
  return res;
}

describe("Bearer auth adapters", () => {
  it("Express blocks protected routes without token", async () => {
    const app = await createExpressApp({
      controllers: [BearerController],
      bearerAuth: { verifyToken }
    });

    const response = await request(app).get("/bearer/protected");

    expect(response.status).toBe(401);
  });

  it("Express allows protected routes with a valid bearer token", async () => {
    const app = await createExpressApp({
      controllers: [BearerController],
      bearerAuth: { verifyToken }
    });

    const response = await request(app)
      .get("/bearer/protected")
      .set("Authorization", "Bearer valid");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "protected" });
  });

  it("Express blocks role routes when bearer user lacks role", async () => {
    const app = await createExpressApp({
      controllers: [BearerController],
      bearerAuth: { verifyToken }
    });

    const response = await request(app)
      .get("/bearer/admin")
      .set("Authorization", "Bearer valid");

    expect(response.status).toBe(403);
  });

  it("Fastify blocks, allows, and applies roles with bearer tokens", async () => {
    const app = await createFastifyApp({
      controllers: [BearerController],
      bearerAuth: { verifyToken }
    });
    await app.ready();

    const blocked = await app.inject({ method: "GET", url: "/bearer/protected" });
    const allowed = await app.inject({
      method: "GET",
      url: "/bearer/protected",
      headers: { authorization: "Bearer valid" }
    });
    const forbidden = await app.inject({
      method: "GET",
      url: "/bearer/admin",
      headers: { authorization: "Bearer valid" }
    });

    expect(blocked.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ message: "protected" });
    expect(forbidden.statusCode).toBe(403);
  });

  it("Native blocks, allows, and applies roles with bearer tokens", async () => {
    const app = await createNativeApp({
      controllers: [BearerController],
      bearerAuth: { verifyToken }
    });

    const blocked = createMockNativeResponse();
    await app.handle(createMockNativeRequest("/bearer/protected"), blocked);

    const allowed = createMockNativeResponse();
    await app.handle(createMockNativeRequest("/bearer/protected", "valid"), allowed);

    const forbidden = createMockNativeResponse();
    await app.handle(createMockNativeRequest("/bearer/admin", "valid"), forbidden);

    expect(blocked.statusCode).toBe(401);
    expect(allowed.statusCode).toBe(200);
    expect(JSON.parse(allowed.body)).toEqual({ message: "protected" });
    expect(forbidden.statusCode).toBe(403);

    await shutdownNativeApp();
  });
});
