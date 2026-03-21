import type {
  Constructor,
  RequestContext as CoreRequestContext,
  UploadedFileInfo
} from "../../core/types";
import type { OpenApiInfo, OpenApiServer } from "../../core/openapi";

/**
 * Request context provided to Fastify route handlers.
 */
export type RequestContext<
  TBody = any,
  TQuery extends object | undefined = Record<string, any>,
  TParams extends object | undefined = Record<string, any>,
  THeaders extends object | undefined = Record<string, any>,
  TFiles extends Record<string, UploadedFileInfo | UploadedFileInfo[]> | undefined = any
> = CoreRequestContext<TBody, TQuery, TParams, THeaders, TFiles>;

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
 * OpenAPI configuration for Fastify adapter.
 */
export interface OpenApiFastifyOptions {
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
  /** Storage type: 'memory' or 'disk' (Fastify adapter mainly supports memory via @fastify/multipart) */
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
 * Options for creating a Fastify application adapter.
 */
export interface FastifyAdapterOptions {
  /** Array of controller classes */
  controllers: Constructor[];
  /** Whether to enable JSON body parsing */
  jsonBody?: boolean;
  /** Max JSON body size (e.g. 1048576 for 1MB). */
  bodyLimit?: number;
  /** OpenAPI configuration */
  openApi?: OpenApiFastifyOptions;
  /** Input coercion setting */
  inputCoercion?: InputCoercionSetting;
  /** CORS configuration. Set to true for permissive defaults, or provide options. */
  cors?: boolean | CorsOptions;
  /** Multipart file upload configuration. Set to true for defaults, or provide options. */
  multipart?: boolean | MultipartOptions;
  /** Validation configuration. Set to false to disable validation, or provide options. */
  validation?: boolean | ValidationOptions;
}
