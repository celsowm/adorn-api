/**
 * Adorn API - Main entry point
 */

// Export config module
export { defineConfig } from './config/defineConfig.js';
export { loadConfig } from './config/loadConfig.js';

// Export decorators
export * from './decorators/index.js';

// Export codegen functions
export { generateRoutes } from './codegen/generateRoutes.js';

// Export OpenAPI functions
export { generateOpenapi } from './openapi/generateOpenapi.js';
