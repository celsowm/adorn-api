import "./runtime/polyfill.js";

export { createExpressRouter, type CreateRouterOptions } from "./adapter/express/index.js";
export { bindRoutes, type BoundRoute } from "./adapter/express/merge.js";
export { createValidator, formatValidationErrors, ValidationErrorResponse } from "./runtime/validation/index.js";
