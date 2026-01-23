import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import {
  requestLogger,
  createLogger,
  jsonTransport,
  prettyTransport,
  type RequestLogEntry,
  type LogEntry
} from "../../src/core/logger";

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/test",
    url: "/test",
    originalUrl: "/test",
    headers: {},
    ip: "127.0.0.1",
    ...overrides
  } as Request;
}

function createMockResponse(): Response & { endCallback?: () => void } {
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    get: vi.fn().mockReturnValue(undefined),
    end: vi.fn(),
    endCallback: undefined as (() => void) | undefined
  } as unknown as Response & { endCallback?: () => void };
  return res;
}

describe("requestLogger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logs request with default options", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry)
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.end();
    expect(entries).toHaveLength(1);
    expect(entries[0].method).toBe("GET");
    expect(entries[0].url).toBe("/test");
    expect(entries[0].status).toBe(200);
    expect(entries[0].level).toBe("info");
  });

  it("sets request ID header", () => {
    const middleware = requestLogger({ transport: () => {} });
    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", expect.any(String));
  });

  it("uses existing request ID from header", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry)
    });

    const req = createMockRequest({
      headers: { "x-request-id": "existing-id" }
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries[0].requestId).toBe("existing-id");
  });

  it("skips paths in skip array", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry),
      skip: ["/health", "/health/live"]
    });

    const req = createMockRequest({ path: "/health" });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries).toHaveLength(0);
  });

  it("skips paths using skip function", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry),
      skip: (req) => req.path.startsWith("/internal")
    });

    const req = createMockRequest({ path: "/internal/metrics" });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries).toHaveLength(0);
  });

  it("logs warn level for 4xx status", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry)
    });

    const req = createMockRequest();
    const res = createMockResponse();
    res.statusCode = 404;
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries[0].level).toBe("warn");
  });

  it("logs error level for 5xx status", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry)
    });

    const req = createMockRequest();
    const res = createMockResponse();
    res.statusCode = 500;
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries[0].level).toBe("error");
  });

  it("respects minimum log level", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry),
      level: "warn"
    });

    const req = createMockRequest();
    const res = createMockResponse();
    res.statusCode = 200;
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries).toHaveLength(0);
  });

  it("includes custom context", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry),
      context: () => ({ userId: "user-123" })
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries[0].context).toEqual({ userId: "user-123" });
  });

  it("measures response time", () => {
    const entries: RequestLogEntry[] = [];
    const middleware = requestLogger({
      transport: (entry) => entries.push(entry)
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);
    res.end();

    expect(entries[0].responseTime).toBeTypeOf("number");
    expect(entries[0].responseTime).toBeGreaterThanOrEqual(0);
  });
});

describe("createLogger", () => {
  it("creates logger with all log methods", () => {
    const logger = createLogger({ transport: () => {} });
    expect(logger.debug).toBeTypeOf("function");
    expect(logger.info).toBeTypeOf("function");
    expect(logger.warn).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
  });

  it("logs at info level by default", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      transport: (entry) => entries.push(entry)
    });

    logger.debug("debug message");
    logger.info("info message");

    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe("info message");
  });

  it("includes context in log entries", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      transport: (entry) => entries.push(entry)
    });

    logger.info("test", { userId: "123" });

    expect(entries[0].context).toEqual({ userId: "123" });
  });

  it("merges default context with call context", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      transport: (entry) => entries.push(entry),
      defaultContext: { service: "api" }
    });

    logger.info("test", { userId: "123" });

    expect(entries[0].context).toEqual({ service: "api", userId: "123" });
  });

  it("respects minimum log level", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      transport: (entry) => entries.push(entry),
      level: "error"
    });

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("error");
  });
});

describe("jsonTransport", () => {
  it("outputs JSON to console.log for info level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const entry: LogEntry = {
      level: "info",
      message: "test",
      timestamp: new Date().toISOString()
    };

    jsonTransport(entry);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(entry));
    spy.mockRestore();
  });

  it("outputs JSON to console.error for error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const entry: LogEntry = {
      level: "error",
      message: "test error",
      timestamp: new Date().toISOString()
    };

    jsonTransport(entry);

    expect(spy).toHaveBeenCalledWith(JSON.stringify(entry));
    spy.mockRestore();
  });
});

describe("prettyTransport", () => {
  it("outputs formatted log to console", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const entry: LogEntry = {
      level: "info",
      message: "test",
      timestamp: "2024-01-15T10:30:00.000Z"
    };

    prettyTransport(entry);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
