export { Controller } from './core/decorators/controller.js';
export {
  Route,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Options,
  Head
} from './core/decorators/route.js';
export { Contract, UseContract } from './core/decorators/contract.js';
export { Tags, Summary, Deprecated } from './core/decorators/tags.js';
export { Response, Throws } from './core/decorators/errors.js';

export { bootstrapControllers } from './core/lifecycle/bootstrap.js';
export type {
  ControllerDefinition,
  ControllerMeta,
  HttpMethod,
  MethodMeta,
  ResponseMeta,
  RouteDefinition,
  RouteRegistry
} from './core/metadata/types.js';

export type {
  Contract as ContractDefinition,
  ContractId,
  ContractList,
  ContractMode,
  ContractPaged,
  ContractQuery,
  ContractRef,
  ContractResult,
  ContractSchemas,
  ContractTypes,
  ContractItem,
  Paginated
} from './contracts/types.js';
export { registerContract } from './contracts/builder.js';
export { addContract, getContract, listContracts } from './contracts/registry.js';
export { resolveContract, resolveContractRef } from './contracts/resolver.js';
export { createMetalContract } from './contracts/query/metal.js';

export type { HttpContext } from './http/context.js';
export { buildRouter } from './http/router.js';
export type { ArgBinding, BindingKind } from './http/bindings.js';
export { bindArgs } from './http/bindings.js';
export type { Middleware } from './http/middleware.js';
export { compose } from './http/middleware.js';
export { HttpError, isHttpError } from './http/errors.js';

export type { OpenApiDocument, OpenApiInfo } from './openapi/builder.js';
export { buildOpenApiSpec } from './openapi/builder.js';
export { mergeSchemas, schemaRef } from './openapi/schema.js';
export { createSwaggerUiHandler, swaggerHtml } from './openapi/swagger.js';

export type { ExpressAdapterOptions } from './adapters/express.js';
export { createExpressAdapter } from './adapters/express.js';
export { createFastifyAdapter } from './adapters/fastify.js';
export { createKoaAdapter } from './adapters/koa.js';

export { registerEntitySchema, getEntitySchema, listEntitySchemas } from './metal/entity.js';
export { mergeOpenApiComponents } from './metal/schema-bridge.js';
export * from './metal/query-contract.js';

export { invariant } from './util/assert.js';
export type { AnyRecord, Constructor } from './util/types.js';
