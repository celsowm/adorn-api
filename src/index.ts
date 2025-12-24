import { ensureDecoratorMetadata } from './runtime/metadataPolyfill.js';
ensureDecoratorMetadata();

export { ensureDecoratorMetadata } from './runtime/metadataPolyfill.js';

export { Controller, Get, Post, Put, Patch, Delete } from './core/decorators.js';
export type { RouteOptions, ControllerOptions } from './core/decorators.js';

export { ValidationError, RouteConfigError } from './core/errors.js';
export type { ValidationIssue, ErrorEnvelope } from './core/errors.js';

export { named, p, q, EmptyQuery, EmptyParams, EmptyBody, EmptyResponse } from './core/schema.js';
export type { SchemaRef } from './core/schema.js';

export { collectManifest } from './core/ir.js';
export type { ManifestIR, RouteIR, ControllerIR } from './core/ir.js';

export { registerControllers, buildApp } from './core/express.js';
export type { RequestContext, RegisterOptions } from './core/express.js';

export { generateOpenApi, generateOpenApiFromManifest } from './openapi/generate.js';
export type { OpenApi31, OpenApiOptions } from './openapi/generate.js';
