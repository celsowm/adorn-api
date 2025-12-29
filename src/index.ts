// Public API exports for adorn-api
// This file defines the stable public API surface that users can rely on

// Core decorators - these are the main public API
export * from './decorators/index.js';

// Error types - public error classes
export { HttpError, ValidationError } from './core/errors/index.js';
export { toProblemDetails } from './core/errors/index.js';

// Validation - public validation API
export * from './core/validation/index.js';

// OpenAPI generation - public API for generating OpenAPI docs
export * from './core/openapi/index.js';

// OpenAPI contracts - public types for OpenAPI
export * from './contracts/openapi.js';

// Response handling - public API for responses
export * from './contracts/responses.js';
export * from './contracts/reply.js';
export * from './core/reply/index.js';

// Route definitions - public API for route configuration
export * from './core/route/index.js';

// Registry types - public types for the registry system
export * from './core/registry/index.js';

// Route options and typing - public API for route configuration
export * from './contracts/route-options.js';
export * from './contracts/route-typing.js';

// Validator contracts - public validation types
export * from './contracts/validator.js';
