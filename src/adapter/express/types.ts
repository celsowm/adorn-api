import type { Request, Response } from "express";
import type { Constructor } from "../../core/types";
import type { OpenApiInfo, OpenApiServer } from "../../core/openapi";
import type { SseEmitter, StreamWriter } from "../../core/streaming";

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
 * Request context provided to route handlers.
 */
export interface RequestContext<
  TBody = unknown,
  TQuery extends object | undefined = Record<string, unknown>,
  TParams extends object | undefined = Record<string, string | number | boolean | undefined>,
  THeaders extends object | undefined = Record<string, string | string[] | undefined>,
  TFiles extends Record<string, UploadedFileInfo | UploadedFileInfo[]> | undefined = undefined
> {
  /** Express request object */
  req: Request;
  /** Express response object */
  res: Response;
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
  sse?: SseEmitter;
  /**
   * Stream writer for streaming responses.
   * Available on routes marked with @Streaming or @Sse decorator.
   */
  stream?: StreamWriter;
}

/**
 * Input coercion modes.
 */
export type InputCoercionMode = "safe" | "strict";

/**
 * Input coercion setting - can be a mode or disabled.
 */
export type InputCoercionSetting = InputCoercionMode | false;

/**
 * CORS configuration options.
 */
export interface CorsOptions {
  /** Allowed origins. Use "*" for all, a string, array of strings, or a function for dynamic matching. */
  origin?: string | string[] | ((origin: string | undefined) => boolean | string);
  /** Allowed HTTP methods. Defaults to ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"]. */
  methods?: string[];
  /** Allowed headers. Defaults to ["Content-Type", "Authorization"]. */
  allowedHeaders?: string[];
  /** Headers exposed to the client. */
  exposedHeaders?: string[];
  /** Whether to include credentials (cookies, authorization headers). Defaults to false. */
  credentials?: boolean;
  /** Max age in seconds for preflight cache. Defaults to 86400 (24 hours). */
  maxAge?: number;
}

/**
 * Options for OpenAPI documentation UI.
 */
export interface OpenApiDocsOptions {
  /** Path for documentation UI */
  path?: string;
  /** Title for documentation page */
  title?: string;
  /** URL for Swagger UI assets */
  swaggerUiUrl?: string;
}

/**
 * OpenAPI configuration for Express adapter.
 */
export interface OpenApiExpressOptions {
  /** OpenAPI document info */
  info: OpenApiInfo;
  /** Array of servers */
  servers?: OpenApiServer[];
  /** Path for OpenAPI JSON endpoint */
  path?: string;
  /** Whether to pretty-print the JSON output (defaults to false for minified output) */
  prettyPrint?: boolean;
  /** Documentation UI configuration */
  docs?: boolean | OpenApiDocsOptions;
}

/**
 * Multipart file upload configuration.
 */
export interface MultipartOptions {
  /** Storage type: 'memory' or 'disk' */
  storage?: "memory" | "disk";
  /** Directory for disk storage (defaults to OS temp directory) */
  dest?: string;
  /** Maximum file size in bytes (defaults to 10MB) */
  maxFileSize?: number;
  /** Maximum number of files per field (defaults to 10) */
  maxFiles?: number;
}

/**
 * Validation configuration options.
 */
export interface ValidationOptions {
  /** Whether validation is enabled. Defaults to true. */
  enabled?: boolean;
  /** Validation mode. 'strict' mode fails on any validation error, 'lax' mode may allow some errors. Defaults to 'strict'. */
  mode?: 'strict' | 'lax';
}

/**
 * Options for creating an Express application adapter.
 */
export interface ExpressAdapterOptions {
  /** Array of controller classes */
  controllers: Constructor[];
  /** Whether to enable JSON body parsing */
  jsonBody?: boolean;
  /** OpenAPI configuration */
  openApi?: OpenApiExpressOptions;
  /** Input coercion setting */
  inputCoercion?: InputCoercionSetting;
  /** CORS configuration. Set to true for permissive defaults, or provide options. */
  cors?: boolean | CorsOptions;
  /** Multipart file upload configuration. Set to true for defaults, or provide options. */
  multipart?: boolean | MultipartOptions;
  /** Validation configuration. Set to false to disable validation, or provide options. */
  validation?: boolean | ValidationOptions;
}
