import { ensureDecoratorMetadata } from './runtime/metadataPolyfill.js';
ensureDecoratorMetadata();

export { ensureDecoratorMetadata } from './runtime/metadataPolyfill.js';

export { Controller, Get, Post, Put, Patch, Delete } from './core/decorators.js';
export type { RouteOptions, ControllerOptions } from './core/decorators.js';

export { ValidationError, RouteConfigError, HttpError, NotFoundError } from './core/errors.js';
export type { ValidationIssue, ErrorEnvelope } from './core/errors.js';

export { named, p, q, EmptyQuery, EmptyParams, EmptyBody, EmptyResponse, registerSchemaProvider } from './core/schema.js';
export type { SchemaRef, InferSchema } from './core/schema.js';

export { collectManifest } from './core/ir.js';
export type { ManifestIR, RouteIR, ControllerIR } from './core/ir.js';

export { registerControllers, buildApp } from './core/express.js';
export type { RequestContext, RegisterOptions, TypedRequestContext } from './core/express.js';
export type { Guard, IncludePolicy } from './core/metadata.js';
export type { IncludeTree } from './core/include.js';

export { generateOpenApi, generateOpenApiFromManifest } from './openapi/generate.js';
export type { OpenApi31, OpenApiOptions } from './openapi/generate.js';

export { MetalOrmCrudController, MetalOrmCrudBase, zodSchemaProvider } from './integrations/metal-orm/index.js';
export type { MetalOrmCrudOptions, SchemaProvider } from './integrations/metal-orm/index.js';
export {
  buildColumnSelection,
  createCrudSchemaIds,
  createMetalOrmZodSchemas,
  defineEntityFields,
  entitySchemas,
  fieldsOf,
  parseEntityView,
  parseEntityViewList,
  safeParseEntityView,
  safeParseEntityViewList,
} from './integrations/metal-orm/index.js';
export type {
  CrudSchemaOptions,
  CrudSchemaOverrides,
  EntitySelection,
  EntityPick,
  EntitySchemas,
  SafeParseResult,
  EntitySchemaOptions,
  EntitySchemaOverrides,
  EntitySchemaView,
  EntitySchemaBody,
  EntitySchemaQuery,
  EntitySchemaAggregates,
  CrudSchemaIds,
  CrudZodSchemas,
} from './integrations/metal-orm/index.js';
