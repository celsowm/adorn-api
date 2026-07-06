import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
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
  Cache,
  InMemoryCacheProvider,
  type RequestContext
} from "../../src/index";

let requestCount = 0;

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

@Controller("/cache-test")
class CacheTestController {
  @Get("/no-cache")
  @Returns(t.object({ count: t.integer() }))
  noCache() {
    requestCount++;
    return { count: requestCount };
  }

  @Get("/with-cache")
  @Cache({ ttl: 30 })
  @Returns(t.object({ count: t.integer() }))
  withCache() {
    requestCount++;
    return { count: requestCount };
  }

  @Get("/with-cache-key")
  @Cache({ ttl: 30, key: "fixed-key" })
  @Returns(t.object({ count: t.integer() }))
  withCacheKey() {
    requestCount++;
    return { count: requestCount };
  }

  @Get("/conditional/:slug")
  @Cache({ ttl: 30, paramKeys: ["slug"], condition: (result) => (result as any)?.count <= 5 })
  @Returns(t.object({ slug: t.string(), count: t.integer() }))
  conditional(ctx: RequestContext<unknown, unknown, { slug: string }>) {
    requestCount++;
    return { slug: ctx.params.slug, count: requestCount };
  }

  @Post("/mutate")
  @Body(CreateUserDto)
  @Returns({ status: 201, schema: t.object({ name: t.string() }) })
  mutate(ctx: RequestContext<CreateUserDto>) {
    return { name: ctx.body.name };
  }
}

describe("Cache E2E", () => {
  let app: Awaited<ReturnType<typeof createExpressApp>>;

  beforeAll(async () => {
    requestCount = 0;
    app = await createExpressApp({
      controllers: [CacheTestController],
      cache: new InMemoryCacheProvider()
    });
  });

  afterAll(async () => {
    requestCount = 0;
  });

  it("should not cache routes without @Cache decorator", async () => {
    const res1 = await request(app).get("/cache-test/no-cache").expect(200);
    expect(res1.body).toEqual({ count: 1 });

    const res2 = await request(app).get("/cache-test/no-cache").expect(200);
    expect(res2.body).toEqual({ count: 2 });
  });

  it("should cache routes with @Cache decorator", async () => {
    const res1 = await request(app).get("/cache-test/with-cache").expect(200);
    expect(res1.body).toEqual({ count: 3 });

    const res2 = await request(app).get("/cache-test/with-cache").expect(200);
    expect(res2.body).toEqual({ count: 3 });
  });

  it("should use fixed cache key when key option is provided", async () => {
    const res1 = await request(app).get("/cache-test/with-cache-key").expect(200);
    expect(res1.body).toEqual({ count: 4 });

    const res2 = await request(app).get("/cache-test/with-cache-key").expect(200);
    expect(res2.body).toEqual({ count: 4 });
  });

  it("should cache based on paramKeys", async () => {
    const res1 = await request(app).get("/cache-test/conditional/foo").expect(200);
    expect(res1.body).toEqual({ slug: "foo", count: 5 });

    const res2 = await request(app).get("/cache-test/conditional/foo").expect(200);
    // Cache hit since same param key "foo"
    expect(res2.body).toEqual({ slug: "foo", count: 5 });

    const res3 = await request(app).get("/cache-test/conditional/bar").expect(200);
    // Different param key "bar", so new request
    expect(res3.body).toEqual({ slug: "bar", count: 6 });
  });

  it("should not cache POST routes", async () => {
    const res1 = await request(app).post("/cache-test/mutate").send({ name: "Alice" }).expect(201);
    expect(res1.body).toEqual({ name: "Alice" });

    const res2 = await request(app).post("/cache-test/mutate").send({ name: "Bob" }).expect(201);
    expect(res2.body).toEqual({ name: "Bob" });
  });
});
