// src/index.ts
// Phase 4: Main exports - Breaking changes, no backward compatibility
// Decorators
export { Controller, Get, Post, Put, Delete, Patch, Status, Authorized, AuthorizedRoute, Produces, Errors, Tags, RouteTags, Summary, Description, FromQuery, FromPath, FromBody, FromHeader, FromCookie, FromRequest, UploadedFile, getControllerMeta, getRouteMeta, getSchemaMeta, META_KEYS, } from './core/decorators.js';
// Configuration
export { DEFAULT_CONFIG, DEFAULT_STATUS_CODES, } from './core/config.js';
// Runtime
export { RuntimeAPI, createRuntimeAPI, } from './core/runtime.js';
// Adapters
export { expressAdapter, } from './core/adapters/express.adapter.js';
export { fastifyAdapter, } from './core/adapters/fastify.adapter.js';
// CLI - for code generation
export * from './cli/index.js';
