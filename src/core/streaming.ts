import type { Response } from "express";

/**
 * Server-Sent Event data structure.
 */
export interface SseEvent {
  /** Event data (will be JSON stringified if object) */
  data: unknown;
  /** Optional event type/name */
  event?: string;
  /** Optional event ID */
  id?: string;
  /** Optional retry interval in milliseconds */
  retry?: number;
}

/**
 * Options for SSE emitter configuration.
 */
export interface SseEmitterOptions {
  /** Keep-alive interval in milliseconds (default: 15000) */
  keepAliveInterval?: number;
  /** Whether to send keep-alive comments (default: true) */
  keepAlive?: boolean;
}

/**
 * SSE Emitter for sending Server-Sent Events to clients.
 */
export class SseEmitter {
  private closed = false;
  private keepAliveTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly res: Response,
    options: SseEmitterOptions = {}
  ) {
    this.setupSseHeaders();

    const { keepAlive = true, keepAliveInterval = 15000 } = options;
    if (keepAlive) {
      this.startKeepAlive(keepAliveInterval);
    }

    res.on("close", () => {
      this.close();
    });
  }

  /**
   * Send an SSE event to the client.
   */
  send(eventOrData: SseEvent | unknown): void {
    if (this.closed) {
      return;
    }

    const event = this.normalizeEvent(eventOrData);
    const message = this.formatEvent(event);
    this.res.write(message);
  }

  /**
   * Send data with a specific event type.
   */
  emit(eventType: string, data: unknown): void {
    this.send({ event: eventType, data });
  }

  /**
   * Send a comment (for keep-alive or debugging).
   */
  comment(text: string): void {
    if (this.closed) {
      return;
    }
    this.res.write(`: ${text}\n\n`);
  }

  /**
   * Close the SSE connection.
   */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }

    if (!this.res.writableEnded) {
      this.res.end();
    }
  }

  /**
   * Check if the connection is closed.
   */
  isClosed(): boolean {
    return this.closed;
  }

  private setupSseHeaders(): void {
    this.res.setHeader("Content-Type", "text/event-stream");
    this.res.setHeader("Cache-Control", "no-cache, no-transform");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no");
    this.res.flushHeaders();
  }

  private startKeepAlive(interval: number): void {
    this.keepAliveTimer = setInterval(() => {
      if (!this.closed) {
        this.comment("keep-alive");
      }
    }, interval);
  }

  private normalizeEvent(eventOrData: SseEvent | unknown): SseEvent {
    if (this.isSseEvent(eventOrData)) {
      return eventOrData;
    }
    return { data: eventOrData };
  }

  private isSseEvent(value: unknown): value is SseEvent {
    return (
      value !== null &&
      typeof value === "object" &&
      "data" in value
    );
  }

  private formatEvent(event: SseEvent): string {
    let message = "";

    if (event.id !== undefined) {
      message += `id: ${event.id}\n`;
    }

    if (event.event !== undefined) {
      message += `event: ${event.event}\n`;
    }

    if (event.retry !== undefined) {
      message += `retry: ${event.retry}\n`;
    }

    const data = typeof event.data === "string"
      ? event.data
      : JSON.stringify(event.data);

    const lines = data.split("\n");
    for (const line of lines) {
      message += `data: ${line}\n`;
    }

    message += "\n";
    return message;
  }
}

/**
 * Create an SSE emitter from an Express response.
 */
export function createSseEmitter(res: Response, options?: SseEmitterOptions): SseEmitter {
  return new SseEmitter(res, options);
}

/**
 * Options for streaming response configuration.
 */
export interface StreamOptions {
  /** Content type for the stream (default: application/octet-stream) */
  contentType?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Stream writer for sending chunked data to clients.
 */
export class StreamWriter {
  private closed = false;

  constructor(
    private readonly res: Response,
    options: StreamOptions = {}
  ) {
    this.setupHeaders(options);

    res.on("close", () => {
      this.closed = true;
    });
  }

  /**
   * Write data to the stream.
   */
  write(data: string | Buffer): boolean {
    if (this.closed) {
      return false;
    }
    return this.res.write(data);
  }

  /**
   * Write a line to the stream (adds newline).
   */
  writeLine(data: string): boolean {
    return this.write(data + "\n");
  }

  /**
   * Write JSON data to the stream.
   */
  writeJson(data: unknown): boolean {
    return this.write(JSON.stringify(data));
  }

  /**
   * Write JSON data followed by a newline (NDJSON format).
   */
  writeJsonLine(data: unknown): boolean {
    return this.writeLine(JSON.stringify(data));
  }

  /**
   * Close the stream.
   */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (!this.res.writableEnded) {
      this.res.end();
    }
  }

  /**
   * Check if the stream is closed.
   */
  isClosed(): boolean {
    return this.closed;
  }

  private setupHeaders(options: StreamOptions): void {
    const contentType = options.contentType ?? "application/octet-stream";
    this.res.setHeader("Content-Type", contentType);
    this.res.setHeader("Transfer-Encoding", "chunked");
    this.res.setHeader("Cache-Control", "no-cache, no-transform");
    this.res.setHeader("X-Accel-Buffering", "no");

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        this.res.setHeader(key, value);
      }
    }

    this.res.flushHeaders();
  }
}

/**
 * Create a stream writer from an Express response.
 */
export function createStreamWriter(res: Response, options?: StreamOptions): StreamWriter {
  return new StreamWriter(res, options);
}

/**
 * Create an NDJSON stream writer (newline-delimited JSON).
 */
export function createNdjsonStream(res: Response): StreamWriter {
  return new StreamWriter(res, { contentType: "application/x-ndjson" });
}

/**
 * Stream an async iterable to the response.
 */
export async function streamIterable<T>(
  res: Response,
  iterable: AsyncIterable<T>,
  options: StreamOptions & { transform?: (item: T) => string | Buffer } = {}
): Promise<void> {
  const writer = new StreamWriter(res, options);
  const transform = options.transform ?? ((item: T) => JSON.stringify(item) + "\n");

  try {
    for await (const item of iterable) {
      if (writer.isClosed()) {
        break;
      }
      writer.write(transform(item));
    }
  } finally {
    writer.close();
  }
}

/**
 * Stream an async iterable as SSE events.
 */
export async function streamSseIterable<T>(
  res: Response,
  iterable: AsyncIterable<T>,
  options: SseEmitterOptions & { eventType?: string } = {}
): Promise<void> {
  const emitter = new SseEmitter(res, options);

  try {
    for await (const item of iterable) {
      if (emitter.isClosed()) {
        break;
      }
      if (options.eventType) {
        emitter.emit(options.eventType, item);
      } else {
        emitter.send(item);
      }
    }
  } finally {
    emitter.close();
  }
}
