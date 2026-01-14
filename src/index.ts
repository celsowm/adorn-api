// Decorators
export * from "./decorators/index.js";

// Core
export {
  ExpressAdapter,
  HttpError,
  isHttpError,
} from "./core/express-adapter.js";

// Metadata
export { metadataStorage } from "./metadata/metadata-storage.js";

// Types
export * from "./types/controller.js";
export * from "./types/metadata.js";
export * from "./types/openapi.js";
export * from "./types/common.js";

// OpenAPI
export { OpenApiGenerator } from "./openapi/openapi-generator.js";
export { setupSwaggerUi, type SwaggerUiOptions } from "./openapi/swagger-ui.js";

// Integrations
export * from "./metal-orm-integration/index.js";

// Validation
export {
  createZodValidationMiddleware,
  formatZodErrors,
  type InferSchema,
} from "./validation/zod-adapter.js";
