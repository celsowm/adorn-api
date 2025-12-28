import type { OpenAPIV3 } from 'openapi-types';
import type { Registry, RouteEntry } from '../registry/types.js';
import type { Schema } from '../../validation/native/schema.js';
import type { ResponsesSpec, ResponseSpec } from '../../contracts/responses.js';
import { normalizeResponses } from '../responses/normalize.js';
import { OasSchemaRegistry } from './schema/registry.js';
import { irToOasSchema } from './schema/toOpenApi.js';
import type { RouteOptions } from '../../contracts/route-options.js';

type RouteOptionsAny = RouteOptions<string>;

export type OpenApiBuildOptions = {
  title: string;
  version: string;
  servers?: { url: string; description?: string }[];
  defaultRequestContentType?: string;
  defaultResponseContentType?: string;
};

export function buildOpenApi(registry: Registry, opts: OpenApiBuildOptions): OpenAPIV3.Document {
  const schemaReg = new OasSchemaRegistry();

  const doc: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: { title: opts.title, version: opts.version },
    servers: opts.servers,
    paths: {},
    components: {},
  };

  for (const r of registry.routes) {
    const pathKey = r.fullPath;
    doc.paths[pathKey] ??= {};

    const method = r.method.toLowerCase() as OpenAPIV3.HttpMethods;
    const ro = (r.options ?? {}) as RouteOptionsAny;

    const op: OpenAPIV3.OperationObject = {
      operationId: `${r.controller.name}.${r.handlerName}`,
      summary: ro.summary,
      description: ro.description,
      tags: ro.tags,
      deprecated: ro.deprecated,
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

  doc.components = schemaReg.getComponents();
  return doc;
}

function addPathParams(
  op: OpenAPIV3.OperationObject,
  r: RouteEntry,
  ro: RouteOptionsAny,
) {
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

function addQueryParams(op: OpenAPIV3.OperationObject, ro: RouteOptionsAny) {
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
  op: OpenAPIV3.OperationObject,
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
  op: OpenAPIV3.OperationObject,
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
): OpenAPIV3.ResponseObject {
  const out: OpenAPIV3.ResponseObject = {
    description: spec.description ?? 'Response',
  };

  if (spec.headers) {
    out.headers = {};
    for (const [h, hv] of Object.entries(spec.headers)) {
      out.headers[h] = {
        description: hv.description,
        required: hv.required,
        schema: schemaReg.toSchemaRef(hv.schema),
      };
    }
  }

  const content: OpenAPIV3.ContentObject = {};
  const entries = Object.entries(spec.content ?? {});
  if (entries.length) {
      for (const [ct, c] of entries) {
        content[ct] = {
          schema: schemaReg.toSchemaRef(c.schema),
          example: c.example,
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
