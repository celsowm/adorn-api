import "./runtime/polyfill.js";

export { createExpressRouter, type CreateRouterOptions } from "./adapter/express/index.js";
export { bindRoutes, type BoundRoute } from "./adapter/express/merge.js";
export { createValidator, formatValidationErrors, ValidationErrorResponse } from "./runtime/validation/index.js";
export { setupSwagger, type SetupSwaggerOptions } from "./adapter/express/index.js";
export { bootstrap, type BootstrapOptions } from "./adapter/express/bootstrap.js";
export { type CorsOptions, type CorsConfig, type StaticOrigin, type CustomOrigin } from "./adapter/express/types.js";

