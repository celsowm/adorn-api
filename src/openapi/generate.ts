import { z } from 'zod';
import type { ManifestIR, RouteIR } from '../core/ir.js';
import type { SchemaRef } from '../core/schema.js';
import { collectManifest } from '../core/ir.js';
import { RouteConfigError } from '../core/errors.js';

export type OpenApi31 = {
  openapi: '3.1.0';
  info: { title: string; version: string; description?: string };
  paths: Record<string, any>;
  components: { schemas: Record<string, any> };
  tags?: Array<{ name: string }>;
};

export type OpenApiOptions = {
  title?: string;
  version?: string;
  description?: string;
};

function sanitizeComponentName(id: string): string {
  // OpenAPI component keys are fairly permissive, but keep it stable + safe.
  return id.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function schemaToJsonSchema(ref: SchemaRef): any {
  if (ref.provider !== 'zod') {
    throw new RouteConfigError(`Unsupported schema provider: ${String((ref as any).provider)}`);
  }
  // Zod v4 native JSON Schema conversion
  // Default target is draft-2020-12 which matches OpenAPI 3.1.
  return z.toJSONSchema(ref.schema, {
    unrepresentable: 'any',
    cycles: 'ref',
    reused: 'inline',
    // io defaults to output; that's what we validate/return by default
  });
}

function pathParamNames(openapiPath: string): string[] {
  const out: string[] = [];
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(openapiPath))) out.push(m[1]!);
  return out;
}

function extractObjectPropertySchema(objectSchema: any, prop: string): any | undefined {
  // Works when schema is an object with `properties`
  if (!objectSchema || typeof objectSchema !== 'object') return undefined;
  if (objectSchema.type !== 'object') return undefined;
  const props = objectSchema.properties;
  if (!props || typeof props !== 'object') return undefined;
  return props[prop];
}

function buildParameters(
  route: RouteIR,
  componentsRef: (ref: SchemaRef) => { $ref: string },
  componentsSchemas: Record<string, any>
) {
  const params: any[] = [];

  // Path params
  if (route.schemas.params) {
    const name = sanitizeComponentName(route.schemas.params.id);
    const objSchema = componentsSchemas[name];
    for (const p of pathParamNames(route.path)) {
      const s = extractObjectPropertySchema(objSchema, p) ?? { type: 'string' };
      params.push({
        name: p,
        in: 'path',
        required: true,
        schema: s,
      });
    }
  }

  // Query params: if query schema is object with properties, render each property
  if (route.schemas.query) {
    const qname = sanitizeComponentName(route.schemas.query.id);
    const qSchema = componentsSchemas[qname];
    const props = qSchema?.type === 'object' ? qSchema.properties : undefined;
    if (props && typeof props === 'object') {
      const required: string[] = Array.isArray(qSchema.required) ? qSchema.required : [];
      for (const [k, v] of Object.entries(props)) {
        params.push({
          name: k,
          in: 'query',
          required: required.includes(k),
          schema: v,
        });
      }
    }
  }

  // include param
  if (route.includePolicy) {
    const allowed = (route.includePolicy.allowed ?? []).filter(Boolean);
    const schema: any = { type: 'array', items: { type: 'string' } };
    if (allowed.length) schema.items = { type: 'string', enum: allowed };
    params.push({
      name: 'include',
      in: 'query',
      required: false,
      style: 'form',
      explode: true,
      schema,
    });
  }

  return params;
}

function ensureComponent(ref: SchemaRef, components: Record<string, any>): { $ref: string } {
  const key = sanitizeComponentName(ref.id);
  if (!components[key]) components[key] = schemaToJsonSchema(ref);
  return { $ref: `#/components/schemas/${key}` };
}

function operationForRoute(
  route: RouteIR,
  components: Record<string, any>,
  tagsByController: Map<Function, string[] | undefined>
) {
  // Ensure core schemas are registered
  if (route.schemas.params) ensureComponent(route.schemas.params, components);
  ensureComponent(route.schemas.query, components);
  if (route.schemas.body) ensureComponent(route.schemas.body, components);
  ensureComponent(route.schemas.response, components);

  const parameters = buildParameters(route, (r) => ensureComponent(r, components), components);

  const tags = tagsByController.get(route.controller);
  const op: any = {
    operationId: `${route.controller.name}_${route.handlerName}`,
    parameters: parameters.length ? parameters : undefined,
    tags: tags?.length ? tags : undefined,
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/${sanitizeComponentName(route.schemas.response.id)}`,
            },
          },
        },
      },
    },
  };

  const needsBody = route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH';
  if (needsBody && route.schemas.body) {
    op.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${sanitizeComponentName(route.schemas.body.id)}` },
        },
      },
    };
  }

  return op;
}

export function generateOpenApi(controllers: Function[], opts: OpenApiOptions = {}): OpenApi31 {
  const manifest = collectManifest(controllers);
  return generateOpenApiFromManifest(manifest, opts);
}

export function generateOpenApiFromManifest(
  manifest: ManifestIR,
  opts: OpenApiOptions = {}
): OpenApi31 {
  const components: Record<string, any> = {};
  const paths: Record<string, any> = {};

  const tagsByController = new Map<Function, string[] | undefined>();
  for (const c of manifest.controllers) tagsByController.set(c.controller, c.tags);

  for (const route of manifest.routes) {
    const pathItem = (paths[route.path] ??= {});
    const methodKey = route.method.toLowerCase();
    pathItem[methodKey] = operationForRoute(route, components, tagsByController);
  }

  // tags list (optional) - union of all controller tags
  const tagNames = new Set<string>();
  for (const t of tagsByController.values()) (t ?? []).forEach((x) => tagNames.add(x));
  const tags = tagNames.size ? [...tagNames].sort().map((name) => ({ name })) : undefined;

  return {
    openapi: '3.1.0',
    info: {
      title: opts.title ?? 'adorn-api',
      version: opts.version ?? '0.0.1',
      description: opts.description,
    },
    paths,
    components: { schemas: components },
    tags,
  };
}
