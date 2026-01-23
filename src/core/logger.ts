import type { Request, Response, NextFunction } from "express";

/**
 * Log levels in order of severity.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry for a request.
 */
export interface RequestLogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** HTTP method */
  method: string;
  /** Request URL path */
  url: string;
  /** HTTP status code */
  status: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Content length of response */
  contentLength?: number;
  /** Client IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
  /** Request ID if available */
  requestId?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Function to output a log entry.
 */
export type LogTransport = (entry: RequestLogEntry) => void;

/**
 * Options for the request logger middleware.
 */
export interface RequestLoggerOptions {
  /** Minimum log level to output (default: "info") */
  level?: LogLevel;
  /** Custom transport function (default: JSON to console) */
  transport?: LogTransport;
  /** Paths to skip logging (e.g., ["/health", "/health/live"]) */
  skip?: string[] | ((req: Request) => boolean);
  /** Header name for request ID (default: "x-request-id") */
  requestIdHeader?: string;
  /** Whether to generate request ID if not present (default: true) */
  generateRequestId?: boolean;
  /** Custom context extractor */
  context?: (req: Request, res: Response) => Record<string, unknown>;
}

/**
 * Logger interface for application-level logging.
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Options for creating a logger.
 */
export interface LoggerOptions {
  /** Minimum log level to output (default: "info") */
  level?: LogLevel;
  /** Custom transport function */
  transport?: (entry: LogEntry) => void;
  /** Default context to include in all log entries */
  defaultContext?: Record<string, unknown>;
}

/**
 * Structured log entry for application logging.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Additional context data */
  context?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Default JSON transport that logs to console.
 */
export function jsonTransport(entry: RequestLogEntry | LogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(output);
  } else if (entry.level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Pretty transport for development.
 */
export function prettyTransport(entry: RequestLogEntry | LogEntry): void {
  const timestamp = entry.timestamp.substring(11, 23);
  const levelColors: Record<LogLevel, string> = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m"
  };
  const reset = "\x1b[0m";
  const color = levelColors[entry.level];

  if ("method" in entry) {
    const statusColor = entry.status >= 400 ? "\x1b[31m" : entry.status >= 300 ? "\x1b[33m" : "\x1b[32m";
    console.log(
      `${color}[${timestamp}]${reset} ${entry.method} ${entry.url} ${statusColor}${entry.status}${reset} ${entry.responseTime}ms`
    );
  } else {
    console.log(`${color}[${timestamp}] ${entry.level.toUpperCase()}${reset} ${entry.message}`);
  }
}

/**
 * Generates a simple unique ID.
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determines log level based on status code.
 */
function statusToLevel(status: number): LogLevel {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/**
 * Creates an Express middleware for request logging.
 * @param options - Logger configuration options
 * @returns Express middleware function
 */
export function requestLogger(options: RequestLoggerOptions = {}) {
  const minLevel = options.level ?? "info";
  const transport = options.transport ?? jsonTransport;
  const requestIdHeader = options.requestIdHeader ?? "x-request-id";
  const generateRequestId = options.generateRequestId ?? true;
  const skipPaths = Array.isArray(options.skip) ? new Set(options.skip) : null;
  const skipFn = typeof options.skip === "function" ? options.skip : null;
  const contextFn = options.context;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipPaths?.has(req.path) || skipFn?.(req)) {
      next();
      return;
    }

    const startTime = process.hrtime.bigint();
    let requestId = req.headers[requestIdHeader] as string | undefined;
    if (!requestId && generateRequestId) {
      requestId = generateId();
    }
    if (requestId) {
      res.setHeader(requestIdHeader, requestId);
    }

    const originalEnd = res.end;
    res.end = function (this: Response, ...args: Parameters<Response["end"]>) {
      const endTime = process.hrtime.bigint();
      const responseTime = Number(endTime - startTime) / 1_000_000;

      const level = statusToLevel(res.statusCode);
      if (LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel]) {
        const entry: RequestLogEntry = {
          level,
          message: `${req.method} ${req.path} ${res.statusCode}`,
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.originalUrl || req.url,
          status: res.statusCode,
          responseTime: Math.round(responseTime * 100) / 100,
          contentLength: res.get("content-length") ? parseInt(res.get("content-length")!, 10) : undefined,
          ip: req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim(),
          userAgent: req.headers["user-agent"],
          requestId,
          context: contextFn?.(req, res)
        };
        transport(entry);
      }

      return originalEnd.apply(this, args);
    } as Response["end"];

    next();
  };
}

/**
 * Creates a structured logger for application-level logging.
 * @param options - Logger configuration options
 * @returns Logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const minLevel = options.level ?? "info";
  const transport = options.transport ?? jsonTransport;
  const defaultContext = options.defaultContext;

  function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context || defaultContext ? { ...defaultContext, ...context } : undefined
    };
    transport(entry);
  }

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context)
  };
}
