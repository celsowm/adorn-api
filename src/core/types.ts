/**
 * Generic constructor type.
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * DTO constructor type.
 */
export type DtoConstructor<T = any> = new (...args: any[]) => T;

/**
 * HTTP method types.
 */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/**
 * Uploaded file information from multipart form data.
 */
export interface UploadedFileInfo {
  /** Original filename as provided by the client */
  originalName: string;
  /** MIME type of the file */
  mimeType: string;
  /** Size of the file in bytes */
  size: number;
  /** File buffer (when using memory storage) */
  buffer?: Buffer;
  /** Path to the file on disk (when using disk storage) */
  path?: string;
  /** Field name from the form */
  fieldName: string;
}

/**
 * Generic request interface.
 */
export interface HttpRequest {
  method: string;
  url: string;
  originalUrl?: string;
  path?: string;
  params: Record<string, any>;
  query: Record<string, any>;
  body: any;
  headers: Record<string, any>;
  ip?: string;
  protocol?: string;
  secure?: boolean;
}

/**
 * Generic response interface.
 */
export interface HttpResponseHeaders {
  [key: string]: string | string[] | undefined;
}

/**
 * Generic response interface.
 */
export interface HttpResponseWriter {
  statusCode: number;
  headersSent: boolean;
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | undefined;
  removeHeader(name: string): void;
  status(code: number): this;
  send(body?: any): this;
  end(): void;
}

/**
 * Server-Sent Event emitter interface.
 */
export interface SseEmitterInterface {
  send(data: any): void;
  emit(event: string, data: any): void;
  comment(text: string): void;
  close(): void;
  isClosed(): boolean;
}

/**
 * Stream writer interface.
 */
export interface StreamWriterInterface {
  write(data: string | Buffer): boolean;
  writeLine(data: string): boolean;
  writeJson(data: any): boolean;
  writeJsonLine(data: any): boolean;
  close(): void;
  isClosed(): boolean;
}

/**
 * Request context provided to route handlers.
 */
export interface RequestContext<
  TBody = any,
  TQuery extends object | undefined = Record<string, any>,
  TParams extends object | undefined = Record<string, any>,
  THeaders extends object | undefined = Record<string, any>,
  TFiles extends Record<string, UploadedFileInfo | UploadedFileInfo[]> | undefined = any
> {
  /** Raw request object */
  req: any;
  /** Raw response object */
  res: any;
  /** Parsed request body */
  body: TBody;
  /** Parsed query parameters */
  query: TQuery;
  /** Parsed path parameters */
  params: TParams;
  /** Request headers */
  headers: THeaders;
  /** Uploaded files (when using multipart handling) */
  files: TFiles;
  /**
   * Server-Sent Events emitter for streaming events to client.
   * Only available on routes marked with @Sse decorator.
   */
  sse?: SseEmitterInterface;
  /**
   * Stream writer for streaming responses.
   * Available on routes marked with @Streaming or @Sse decorator.
   */
  stream?: StreamWriterInterface;
}
