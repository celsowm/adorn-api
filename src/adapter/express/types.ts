import type { Request } from "express";
import type { ManifestV1 } from "../../compiler/manifest/format.js";
import type { AuthSchemeRuntime } from "../../runtime/auth/runtime.js";

/**
 * OpenAPI 3.1 specification structure
 */
export interface OpenAPI31 {
    openapi: string;
    components: {
        schemas: Record<string, Record<string, unknown>>;
        securitySchemes?: Record<string, Record<string, unknown>>;
    };
    paths?: Record<string, Record<string, any>>;
    security?: Array<Record<string, string[]>>;
}

/**
 * Express request with authentication data
 */
export interface AuthenticatedRequest extends Request {
    auth?: any;
}

/**
 * Coercion options for request parameters
 */
export interface CoerceOptions {
    body?: boolean;
    query?: boolean;
    path?: boolean;
    header?: boolean;
    cookie?: boolean;
    dateTime?: boolean;
    date?: boolean;
}

/**
 * Options for creating an Express router
 */
export interface CreateRouterOptions {
    controllers: Array<new (...args: any[]) => any>;
    artifactsDir?: string;
    manifest?: ManifestV1;
    openapi?: OpenAPI31;
    auth?: {
        schemes: Record<string, AuthSchemeRuntime>;
    };
    coerce?: CoerceOptions;
    defaultPageSize?: number;
    middleware?: {
        global?: Array<string | ((req: any, res: any, next: (err?: any) => void) => any)>;
        named?: Record<string, (req: any, res: any, next: (err?: any) => void) => any>;
    };
}

/**
 * Options for setting up Swagger UI
 */
export interface SetupSwaggerOptions {
    artifactsDir?: string;
    jsonPath?: string;
    uiPath?: string;
    swaggerOptions?: {
        url?: string;
        servers?: Array<{ url: string; description?: string }>;
        [key: string]: any;
    };
}

/**
 * Represents a validation error
 */
export interface ValidationError {
    path: string;
    message: string;
    keyword: string;
    params: Record<string, unknown>;
}

export type CoerceLocation = "body" | "query" | "path" | "header" | "cookie";
export type DateCoercionOptions = { dateTime: boolean; date: boolean };
