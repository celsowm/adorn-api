import type { Request, Response } from "express";
import type { Constructor } from "../../core/types";
import type { OpenApiInfo, OpenApiServer } from "../../core/openapi";

/**
 * Request context provided to route handlers.
 */
export interface RequestContext<
  TBody = unknown,
  TQuery extends object | undefined = Record<string, unknown>,
  TParams extends object | undefined = Record<string, string | number | boolean | undefined>,
  THeaders extends object | undefined = Record<string, string | string[] | undefined>
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
  /** Documentation UI configuration */
  docs?: boolean | OpenApiDocsOptions;
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
}
