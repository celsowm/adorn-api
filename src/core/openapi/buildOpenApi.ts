import type {
  OpenApiDocument,
  OperationObject,
  ResponseObject,
  HttpMethod,
  MediaTypeObject,
} from '../../contracts/openapi-v3.js';
import type { Registry, RouteEntry } from '../registry/types.js';
import type { ResponsesSpec, ResponseSpec } from '../../contracts/responses.js';
import { normalizeResponses } from '../responses/normalize.js';
import { OasSchemaRegistry } from './schema/registry.js';
import { irToOasSchema } from './schema/toOpenApi.js';
import type { RouteOptions } from '../../contracts/route-options.js';

type RouteOptionsAny = RouteOptions<string>;

/**
 * Options for building OpenAPI documentation.
 *
 * These options configure the basic metadata and behavior of the generated
 * OpenAPI specification.
 */
export type OpenApiBuildOptions = {
  /** Title of the API */
  title: string;
  /** Version of the API */
  version: string;
  /** Array of server objects with URLs and descriptions */
  servers?: { url: string; description?: string }[];
  /** Default content type for request bodies */
  defaultRequestContentType?: string;
  /** Default content type for response bodies */
  defaultResponseContentType?: string;
};

/**
 * Builds a complete OpenAPI 3.0.3 specification document from the route registry.
 *
 * This function generates a comprehensive OpenAPI specification by analyzing
 * the route registry and extracting all necessary information including paths,
 * operations, parameters, request/response bodies, and security schemes.
 *
 * @param registry - Route registry containing all registered routes and metadata
 * @param opts - OpenAPI build options including title, version, and servers
 * @returns Complete OpenAPI 3.0.3 document ready for serving or serialization
 *
 * @example
 * ```typescript
 * import { buildRegistry } from './registry';
 * import { buildOpenApi } from './openapi';
 *
 * // Build route registry from controllers
 * const registry = buildRegistry([UserController, ProductController]);
 *
 * // Generate OpenAPI specification
 * const openApiDoc = buildOpenApi(registry, {
 *   title: 'My API',
 *   version: '1.0.0',
 *   servers: [
 *     { url: 'https://api.example.com/v1', description: 'Production server' },
 *     { url: 'https://staging.api.example.com/v1', description: 'Staging server' }
 *   ],
 *   defaultRequestContentType: 'application/json',
 *   defaultResponseContentType: 'application/json'
 * });
 *
 * // Serve the OpenAPI JSON
 * app.get('/openapi.json', (req, res) => {
 *   res.json(openApiDoc);
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom content types
 * const openApiDoc = buildOpenApi(registry, {
 *   title: 'Multi-format API',
 *   version: '2.0.0',
 *   defaultRequestContentType: 'application/json',
 *   defaultResponseContentType: 'application/problem+json'
 * });
 *
 * // The generated spec will use application/problem+json for error responses
 * // and application/json for successful responses by default
 * ```
 *
 * @see Registry for route registry structure
 * @see OpenApiDocument for the returned document structure
 */
export function buildOpenApi(registry: Registry, opts: OpenApiBuildOptions): OpenApiDocument {
  const schemaReg = new OasSchemaRegistry();

  const doc: OpenApiDocument = {
    openapi: '3.0.3',
    info: { title: opts.title, version: opts.version },
    ...(opts.servers !== undefined ? { servers: opts.servers } : {}),
    paths: {},
  };

  for (const r of registry.routes) {
    const pathKey = r.fullPath;
    doc.paths[pathKey] ??= {};

    const method = r.method.toLowerCase() as HttpMethod;
    const ro = (r.options ?? {}) as RouteOptionsAny;

    const op: OperationObject = {
      operationId: ro.operationId ?? `${r.controller.name}.${r.handlerName}`,
      ...(ro.summary !== undefined ? { summary: ro.summary } : {}),
      ...(ro.description !== undefined ? { description: ro.description } : {}),
      ...(ro.tags !== undefined ? { tags: ro.tags } : {}),
      ...(ro.deprecated !== undefined ? { deprecated: ro.deprecated } : {}),
      ...(ro.security !== undefined ? { security: ro.security } : {}),
      parameters: [],
      responses: {},
    };

    addPathParams(op, r, ro);
    addQueryParams(op, ro);
    addRequestBody(op, r, ro, schemaReg, opts.defaultRequestContentType ?? 'application/json');
    addResponses(
      op,
      r,
      ro,
      schemaReg,
      opts.defaultResponseContentType ?? 'application/json',
    );

    (doc.paths[pathKey] as any)[method] = op;
  }

  const components = schemaReg.getComponents();
  if (registry.securitySchemes && Object.keys(registry.securitySchemes).length) {
    components.securitySchemes = registry.securitySchemes;
  }
  if (Object.keys(components).length) {
    doc.components = components;
  }
  return doc;
}

function addPathParams(op: OperationObject, r: RouteEntry, ro: RouteOptionsAny) {
  const paramsSchema = ro.validate?.params;
  if (paramsSchema?.ir.kind === 'object') {
    const seen = new Set(
      Array.from(r.fullPath.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]),
    );

    for (const [name, propIr] of Object.entries(paramsSchema.ir.properties)) {
      if (!seen.has(name)) continue;

      op.parameters!.push({
        name,
        in: 'path',
        required: true,
        schema: irToOasSchema(propIr),
      });
    }
    return;
  }

  const fallbackNames = Array.from(r.fullPath.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]);
  for (const name of fallbackNames) {
    op.parameters!.push({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }
}

function addQueryParams(op: OperationObject, ro: RouteOptionsAny) {
  const q = ro.validate?.query;
  if (!q || q.ir.kind !== 'object') return;

  const required = new Set(q.ir.required);

  for (const [name, propIr] of Object.entries(q.ir.properties)) {
    op.parameters!.push({
      name,
      in: 'query',
      required: required.has(name),
      schema: irToOasSchema(propIr),
    });
  }
}

function addRequestBody(
  op: OperationObject,
  r: RouteEntry,
  ro: RouteOptionsAny,
  schemaReg: OasSchemaRegistry,
  defaultContentType: string,
) {
  const b = ro.validate?.body;
  if (!b) return;
  if (!['POST', 'PUT', 'PATCH'].includes(r.method)) return;

  op.requestBody = {
    required: true,
    content: {
      [defaultContentType]: {
        schema: schemaReg.toSchemaRef(b),
      },
    },
  };
}

function addResponses(
  op: OperationObject,
  r: RouteEntry,
  ro: RouteOptionsAny,
  schemaReg: OasSchemaRegistry,
  defaultContentType: string,
) {
  const normalized = normalizeResponses(ro.responses);

  if (!Object.keys(normalized).length) {
    op.responses = { 200: { description: 'OK' } };
    return;
  }

  for (const [status, spec] of Object.entries(normalized)) {
    op.responses![status] = responseSpecToOas(spec, schemaReg, defaultContentType);
  }
}

function responseSpecToOas(
  spec: ResponseSpec,
  schemaReg: OasSchemaRegistry,
  defaultContentType: string,
): ResponseObject {
  const out: ResponseObject = {
    description: spec.description ?? 'Response',
  };

  if (spec.headers) {
    out.headers = {};
    for (const [h, hv] of Object.entries(spec.headers)) {
      out.headers[h] = {
        ...(hv.description !== undefined ? { description: hv.description } : {}),
        ...(hv.required !== undefined ? { required: hv.required } : {}),
        schema: schemaReg.toSchemaRef(hv.schema),
      };
    }
  }

  const content: Record<string, MediaTypeObject> = {};
  const entries = Object.entries(spec.content ?? {});
  if (entries.length) {
    for (const [ct, c] of entries) {
      content[ct] = {
        schema: schemaReg.toSchemaRef(c.schema),
        ...(c.example !== undefined ? { example: c.example } : {}),
      };
    }
  } else if ((spec as any).schema) {
    content[defaultContentType] = {
      schema: schemaReg.toSchemaRef((spec as any).schema),
    };
  }

  if (Object.keys(content).length) out.content = content;
  return out;
}
