export * from "./core/decorators";
export * from "./core/schema";
export * from "./core/openapi";
export * from "./core/errors";
export * from "./core/response";
export * from "./core/validation";
export * from "./core/validation-errors";
export * from "./core/coerce";
export * from "./core/health";
export * from "./core/logger";
export * from "./core/serialization";
export * from "./core/auth";
export * from "./core/lifecycle";
export * from "./core/streaming";
export {
    createExpressApp,
    attachControllers as attachExpressControllers,
    attachOpenApi as attachExpressOpenApi,
    shutdownApp as shutdownExpressApp
} from "./adapter/express/index";
export type {
    ExpressAdapterOptions,
    RequestContext as ExpressRequestContext
} from "./adapter/express/index";
export {
    createFastifyApp,
    attachControllers as attachFastifyControllers,
    attachOpenApi as attachFastifyOpenApi,
    shutdownApp as shutdownFastifyApp
} from "./adapter/fastify/index";
export type {
    FastifyAdapterOptions,
    RequestContext as FastifyRequestContext
} from "./adapter/fastify/index";
export {
    createNativeApp,
    attachControllers as attachNativeControllers,
    attachOpenApi as attachNativeOpenApi,
    shutdownApp as shutdownNativeApp
} from "./adapter/native/index";
export type {
    NativeAdapterOptions,
    RequestContext as NativeRequestContext,
    NativeApp
} from "./adapter/native/index";
export * from "./adapter/metal-orm/index";
export * from "./core/types";