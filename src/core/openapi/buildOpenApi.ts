import type {
  OpenApiDocument,
  OperationObject,
  ResponseObject,
  HttpMethod,
  MediaTypeObject,
  PathItemObject,
  ParameterObject,
  SchemaObject,
  OpenApiVersion,
  ContactObject,
  LicenseObject,
  RequestBodyObject,
} from '../../contracts/openapi-v3.js';
import type { Registry, RouteEntry } from '../registry/types.js';
import type { ResponseSpec } from '../../contracts/responses.js';
import { normalizeResponses } from '../responses/normalize.js';
import { OasSchemaRegistry } from './schema/registry.js';
import { irToOasSchema } from './schema/toOpenApi.js';
import { pickSuccessStatus } from '../responses/pickStatus.js';
import type { RouteOptions, ScalarHint } from '../../contracts/route-options.js';
import type { Schema } from '../../validation/native/schema.js';
import type { ProblemDetails } from '../../contracts/errors.js';
import { problemDetailsSchema, validationProblemDetailsSchema } from './default-errors.js';

type RouteOptionsAny = RouteOptions<string>;

/**
 * Options for building OpenAPI documentation.
 *
 * These options configure the metadata, schema preferences, and default
 * behaviors for the generated OpenAPI specification.
 */
export type OpenApiBuildOptions = {
  /** Title of the API */
  title: string;
  /** Version of the API */
  version: string;
  /** OpenAPI version to emit (defaults to 3.0.3) */
  openapiVersion?: OpenApiVersion;
  /** Optional description shown in `info` */
  description?: string;
  /** Optional terms of service URL */
  termsOfService?: string;
  /** Optional contact metadata */
  contact?: ContactObject;
  /** Optional license metadata */
  license?: LicenseObject;
  /** Array of server objects with URLs and descriptions */
  servers?: { url: string; description?: string }[];
  /** Default content type for request bodies (default: application/json) */
  defaultRequestContentType?: string;
  /** Default content type for successful responses (default: application/json) */
  defaultResponseContentType?: string;
  /** Content type to use for default error responses (default: application/problem+json) */
  defaultErrorContentType?: string;
  /** Whether to automatically include validation/problem detail responses */
  includeDefaultErrors?: boolean;
  /** Schema to describe problem details responses */
  problemDetailsSchema?: Schema<ProblemDetails>;
  /** Schema to describe validation error responses */
  validationErrorSchema?: Schema<ProblemDetails>;
};

/**
 * Builds a complete OpenAPI document from the route registry.
 */
export function buildOpenApi(registry: Registry, opts: OpenApiBuildOptions): OpenApiDocument {
  const schemaReg = new OasSchemaRegistry();

  const defaultRequestContentType = opts.defaultRequestContentType ?? 'application/json';
  const defaultResponseContentType = opts.defaultResponseContentType ?? 'application/json';
  const defaultErrorContentType = opts.defaultErrorContentType ?? 'application/problem+json';
  const includeDefaultErrors = opts.includeDefaultErrors ?? false;
  const resolvedProblemDetails = opts.problemDetailsSchema ?? problemDetailsSchema;
  const resolvedValidationSchema = opts.validationErrorSchema ?? validationProblemDetailsSchema;

  const doc: OpenApiDocument = {
    openapi: opts.openapiVersion ?? '3.0.3',
    info: {
      title: opts.title,
      version: opts.version,
      ...(opts.description ? { description: opts.description } : {}),
      ...(opts.termsOfService ? { termsOfService: opts.termsOfService } : {}),
      ...(opts.contact ? { contact: opts.contact } : {}),
      ...(opts.license ? { license: opts.license } : {}),
    },
    ...(opts.servers !== undefined ? { servers: opts.servers } : {}),
    paths: {},
  };

  for (const r of registry.routes) {
    const pathKey = r.fullPath;
    doc.paths[pathKey] ??= {};

    const method = r.method.toLowerCase() as HttpMethod;
    const ro = (r.options ?? {}) as RouteOptionsAny;

    const parameters: ParameterObject[] = [];
    addPathParams(parameters, r, ro);
    addQueryParams(parameters, ro);

    const responses = addResponses(
      ro,
      r,
      schemaReg,
      defaultResponseContentType,
      defaultErrorContentType,
      includeDefaultErrors,
      resolvedProblemDetails,
      resolvedValidationSchema,
    );

    const op: OperationObject = {
      operationId: ro.operationId ?? `${r.controller.name}.${r.handlerName}`,
      ...(ro.summary !== undefined ? { summary: ro.summary } : {}),
      ...(ro.description !== undefined ? { description: ro.description } : {}),
      ...(ro.tags !== undefined ? { tags: ro.tags } : {}),
      ...(ro.deprecated !== undefined ? { deprecated: ro.deprecated } : {}),
      ...(ro.security !== undefined ? { security: ro.security } : {}),
      responses,
    };

    if (parameters.length) {
      op.parameters = parameters;
    }

    const requestBody = addRequestBody(r, ro, schemaReg, defaultRequestContentType);
    if (requestBody) {
      op.requestBody = requestBody;
    }

    const pathItem: PathItemObject = doc.paths[pathKey] ?? {};
    pathItem[method] = op;
    doc.paths[pathKey] = pathItem;
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

function addPathParams(parameters: ParameterObject[], r: RouteEntry, ro: RouteOptionsAny) {
  const paramsSchema = ro.validate?.params;
  if (paramsSchema?.ir.kind === 'object') {
    const seen = new Set(
      Array.from(r.fullPath.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]),
    );

    for (const [name, propIr] of Object.entries(paramsSchema.ir.properties)) {
      if (!seen.has(name)) continue;

      parameters.push({
        name,
        in: 'path',
        required: true,
        schema: irToOasSchema(propIr),
      });
    }
    return;
  }

  const fallbackNames = Array.from(r.fullPath.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]);

  const optionHints = ro.bindings?.path ?? {};
  const metaHints = r.bindings?.byMethod?.[r.handlerName]?.path ?? {};
  const hints: Record<string, ScalarHint | undefined> = { ...optionHints, ...metaHints };

  for (const name of fallbackNames) {
    parameters.push({
      name,
      in: 'path',
      required: true,
      schema: schemaFromHint(hints[name]),
    });
  }
}

function addQueryParams(parameters: ParameterObject[], ro: RouteOptionsAny) {
  const q = ro.validate?.query;
  if (!q || q.ir.kind !== 'object') return;

  const required = new Set(q.ir.required);

  for (const [name, propIr] of Object.entries(q.ir.properties)) {
    parameters.push({
      name,
      in: 'query',
      required: required.has(name),
      schema: irToOasSchema(propIr),
    });
  }
}

function addRequestBody(
  r: RouteEntry,
  ro: RouteOptionsAny,
  schemaReg: OasSchemaRegistry,
  defaultContentType: string,
): RequestBodyObject | undefined {
  const b = ro.validate?.body;
  if (!b) return undefined;
  if (!['POST', 'PUT', 'PATCH'].includes(r.method)) return undefined;

  const required = b.ir.kind !== 'optional';

  return {
    required,
    content: {
      [defaultContentType]: {
        schema: schemaReg.toSchemaRef(b),
      },
    },
  };
}

function addResponses(
  ro: RouteOptionsAny,
  r: RouteEntry,
  schemaReg: OasSchemaRegistry,
  defaultResponseContentType: string,
  defaultErrorContentType: string,
  includeDefaultErrors: boolean,
  problemSchema: Schema<ProblemDetails>,
  validationSchema: Schema<ProblemDetails>,
): Record<string, ResponseObject> {
  const normalized = normalizeResponses(ro.responses);
  const responses: Record<string, ResponseObject> = {};

  for (const [status, spec] of Object.entries(normalized)) {
    responses[status] = responseSpecToOas(spec, schemaReg, defaultResponseContentType);
  }

  if (!Object.keys(responses).length) {
    const status = pickSuccessStatus(r.method, ro.responses, ro.successStatus);
    responses[String(status)] = defaultSuccessResponse(status);
  }

  if (includeDefaultErrors) {
    addErrorResponse(
      responses,
      '400',
      'Validation Error',
      validationSchema,
      defaultErrorContentType,
      schemaReg,
    );
    addErrorResponse(
      responses,
      '500',
      'Problem Details',
      problemSchema,
      defaultErrorContentType,
      schemaReg,
    );
  }

  return responses;
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
  } else if (spec.schema) {
    content[defaultContentType] = {
      schema: schemaReg.toSchemaRef(spec.schema),
    };
  }

  if (Object.keys(content).length) out.content = content;
  return out;
}

function defaultSuccessResponse(status: number): ResponseObject {
  const descriptions: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
  };

  return {
    description: descriptions[status] ?? 'Successful response',
  };
}

function addErrorResponse(
  responses: Record<string, ResponseObject>,
  status: string,
  description: string,
  schema: Schema<ProblemDetails>,
  contentType: string,
  schemaReg: OasSchemaRegistry,
) {
  if (responses[status]) return;

  const spec: ResponseSpec = {
    description,
    content: {
      [contentType]: {
        schema,
      },
    },
  };

  responses[status] = responseSpecToOas(spec, schemaReg, contentType);
}

const PATH_HINTS: Record<ScalarHint, SchemaObject> = {
  boolean: { type: 'boolean' },
  int: { type: 'integer', format: 'int32' },
  number: { type: 'number' },
  string: { type: 'string' },
  uuid: { type: 'string', format: 'uuid' },
};

function schemaFromHint(hint?: ScalarHint): SchemaObject {
  if (hint && PATH_HINTS[hint]) {
    return PATH_HINTS[hint];
  }
  return { type: 'string' };
}
