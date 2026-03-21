import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  Constructor,
  RequestContext as CoreRequestContext,
  UploadedFileInfo
} from "../../core/types";
import type { OpenApiInfo, OpenApiServer } from "../../core/openapi";

export { UploadedFileInfo };

/**
 * Request context provided to native route handlers.
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
 * OpenAPI configuration for native adapter.
 */
export interface OpenApiNativeOptions {
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
 * Validation configuration options.
 */
export interface ValidationOptions {
  /** Whether validation is enabled. Defaults to true. */
  enabled?: boolean;
  /** Validation mode. 'strict' mode fails on any validation error, 'lax' mode may allow some errors. Defaults to 'strict'. */
  mode?: "strict" | "lax";
}

/**
 * Options for creating a native Node.js application adapter.
 */
export interface NativeAdapterOptions {
  /** Array of controller classes */
  controllers: Constructor[];
  /** Whether to enable JSON body parsing */
  jsonBody?: boolean;
  /** Max JSON body size in bytes. */
  bodyLimit?: number;
  /** OpenAPI configuration */
  openApi?: OpenApiNativeOptions;
  /** Input coercion setting */
  inputCoercion?: InputCoercionSetting;
  /** Validation configuration. Set to false to disable validation, or provide options. */
  validation?: boolean | ValidationOptions;
}

/**
 * Interface for the native application.
 */
export interface NativeApp {
  /** The native Node.js request handler */
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
  /** Start the server on the specified port */
  listen(port: number, callback?: () => void): any;
}
