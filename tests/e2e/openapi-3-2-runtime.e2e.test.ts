import { request as createHttpRequest, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  Controller,
  createExpressApp,
  createFastifyApp,
  createNativeApp,
  Head,
  Http,
  Options,
  QueryMethod,
  QueryString,
  Returns,
  t,
  Trace,
  type RequestContext
} from "../../src";

describe("OpenAPI 3.2 runtime support", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => closeServer(server)));
    servers.length = 0;
  });

  @Controller("/oas32-runtime")
  class Oas32RuntimeController {
    @Head("/head")
    @Returns({ status: 204 })
    head() {
      return undefined;
    }

    @Options("/options")
    options() {
      return { method: "OPTIONS" };
    }

    @Trace("/trace")
    trace() {
      return { method: "TRACE" };
    }

    @QueryMethod("/query-method")
    queryMethod() {
      return { method: "QUERY" };
    }

    @Http("LINK", "/link")
    link() {
      return { method: "LINK" };
    }

    @Http("SEARCH", "/parsed")
    @QueryString(t.object({ q: t.string(), page: t.optional(t.integer()) }))
    parsed(ctx: RequestContext<any, any, any, any, any, { q: string; page?: number }>) {
      return ctx.querystring;
    }

    @Http("SEARCH", "/raw")
    @QueryString(t.string(), { contentType: "text/plain" })
    raw(ctx: RequestContext<any, any, any, any, any, string>) {
      return { raw: ctx.querystring };
    }
  }

  it("Express handles additional methods and querystring inputs", async () => {
    const app = await createExpressApp({ controllers: [Oas32RuntimeController] });
    const server = app.listen(0);
    servers.push(server);
    await waitForListening(server);
    const origin = `http://127.0.0.1:${(server.address() as any).port}`;

    expect((await httpRequest(origin, "HEAD", "/oas32-runtime/head")).status).toBe(204);
    expect(await jsonRequest(origin, "OPTIONS", "/oas32-runtime/options")).toEqual({ method: "OPTIONS" });
    expect(await jsonRequest(origin, "TRACE", "/oas32-runtime/trace")).toEqual({ method: "TRACE" });
    expect(await jsonRequest(origin, "QUERY", "/oas32-runtime/query-method")).toEqual({ method: "QUERY" });
    expect(await jsonRequest(origin, "LINK", "/oas32-runtime/link")).toEqual({ method: "LINK" });
    expect(await jsonRequest(origin, "SEARCH", "/oas32-runtime/parsed?q=term&page=2")).toEqual({ q: "term", page: 2 });
    expect(await jsonRequest(origin, "SEARCH", "/oas32-runtime/raw?q=term&page=2")).toEqual({ raw: "q=term&page=2" });
  });

  it("Fastify handles additional methods and querystring inputs", async () => {
    const app = await createFastifyApp({ controllers: [Oas32RuntimeController] });
    await app.ready();

    expect((await app.inject({ method: "HEAD", url: "/oas32-runtime/head" })).statusCode).toBe(204);
    expect((await app.inject({ method: "OPTIONS", url: "/oas32-runtime/options" })).json()).toEqual({ method: "OPTIONS" });
    expect((await app.inject({ method: "TRACE", url: "/oas32-runtime/trace" })).json()).toEqual({ method: "TRACE" });
    expect((await app.inject({ method: "QUERY" as any, url: "/oas32-runtime/query-method" })).json()).toEqual({ method: "QUERY" });
    expect((await app.inject({ method: "LINK" as any, url: "/oas32-runtime/link" })).json()).toEqual({ method: "LINK" });
    expect((await app.inject({ method: "SEARCH" as any, url: "/oas32-runtime/parsed?q=term&page=2" })).json()).toEqual({ q: "term", page: 2 });
    expect((await app.inject({ method: "SEARCH" as any, url: "/oas32-runtime/raw?q=term&page=2" })).json()).toEqual({ raw: "q=term&page=2" });

    await app.close();
  });

  it("native adapter handles additional methods and querystring inputs", async () => {
    const app = await createNativeApp({ controllers: [Oas32RuntimeController] });

    expect((await nativeRequest(app, "HEAD", "/oas32-runtime/head")).status).toBe(204);
    expect(await nativeJson(app, "OPTIONS", "/oas32-runtime/options")).toEqual({ method: "OPTIONS" });
    expect(await nativeJson(app, "TRACE", "/oas32-runtime/trace")).toEqual({ method: "TRACE" });
    expect(await nativeJson(app, "QUERY", "/oas32-runtime/query-method")).toEqual({ method: "QUERY" });
    expect(await nativeJson(app, "LINK", "/oas32-runtime/link")).toEqual({ method: "LINK" });
    expect(await nativeJson(app, "SEARCH", "/oas32-runtime/parsed?q=term&page=2")).toEqual({ q: "term", page: 2 });
    expect(await nativeJson(app, "SEARCH", "/oas32-runtime/raw?q=term&page=2")).toEqual({ raw: "q=term&page=2" });
  });
});

async function jsonRequest(origin: string, method: string, path: string): Promise<unknown> {
  const response = await httpRequest(origin, method, path);
  return response.body ? JSON.parse(response.body) : undefined;
}

async function httpRequest(origin: string, method: string, path: string): Promise<{ status: number; body: string }> {
  const url = new URL(path, origin);
  return new Promise((resolve, reject) => {
    const req = createServerRequest(url, method, (status, body) => resolve({ status, body }));
    req.on("error", reject);
    req.end();
  });
}

function createServerRequest(
  url: URL,
  method: string,
  done: (status: number, body: string) => void
) {
  const req = createHttpRequest(
    {
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method
    },
    (res: any) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
      });
      res.on("end", () => done(res.statusCode ?? 0, body));
    }
  );
  return req;
}

async function nativeJson(app: any, method: string, url: string): Promise<unknown> {
  const response = await nativeRequest(app, method, url);
  return response.body ? JSON.parse(response.body) : undefined;
}

async function nativeRequest(app: any, method: string, url: string): Promise<{ status: number; body: string }> {
  const req: any = {
    method,
    url,
    headers: {},
    on: (event: string, cb: () => void) => {
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
    end(data?: string) {
      res.body = data ?? "";
    }
  };

  await app.handle(req, res);
  return { status: res.statusCode, body: res.body ?? "" };
}

async function waitForListening(server: Server): Promise<void> {
  if (server.listening) {
    return;
  }
  await new Promise<void>((resolve) => server.once("listening", resolve));
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
