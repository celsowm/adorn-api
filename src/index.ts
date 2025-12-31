import "./runtime/polyfill.js";

export { Controller, Get, Post, Put, Patch, Delete, Use, Auth, Public } from "./decorators/index.js";
export { readAdornBucket } from "./runtime/metadata/read.js";
export type { HttpMethod, RouteOperation, AdornBucket, AuthMeta, ExpressMw } from "./runtime/metadata/types.js";
export type { AuthSchemeRuntime, AuthResult } from "./runtime/auth/runtime.js";
export * from "./schema/index.js";
export { createValidator, formatValidationErrors, ValidationErrorResponse } from "./runtime/validation/index.js";
