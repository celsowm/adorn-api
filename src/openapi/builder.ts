import type { RequestBodyMeta, ResponseMeta, RouteRegistry } from '../core/metadata/types.js';
import { resolveContractRef } from '../contracts/resolver.js';
import type { ContractMode } from '../contracts/types.js';
import { mergeOpenApiComponents } from '../metal/schema-bridge.js';

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: OpenApiInfo;
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
}

export type OpenApiSpecEnhancer = (spec: OpenApiDocument) => OpenApiDocument | void;

export interface OpenApiSpecOptions {
  enhance?: OpenApiSpecEnhancer | OpenApiSpecEnhancer[];
  useDefaultEnhancers?: boolean;
}

const defaultEnhancers: OpenApiSpecEnhancer[] = [];

export const registerOpenApiEnhancer = (enhancer: OpenApiSpecEnhancer): void => {
  defaultEnhancers.push(enhancer);
};

const isArraySchema = (schema: unknown): schema is { type?: string; items?: unknown } =>
  typeof schema === 'object' && schema !== null && 'type' in schema && (schema as { type?: string }).type === 'array';

const bodyMethods = new Set(['post', 'put', 'patch', 'delete']);

const isRequestBodyMeta = (value: unknown): value is RequestBodyMeta =>
  typeof value === 'object' && value !== null;

const buildResponseSchema = (mode: ContractMode | undefined, output: unknown): Record<string, unknown> | undefined => {
  if (!output) return undefined;

  if (mode === 'single') {
    return output as Record<string, unknown>;
  }

  const itemSchema = isArraySchema(output) ? output.items : output;

  if (mode === 'paged') {
    return {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: itemSchema
        },
        totalItems: { type: 'integer' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' }
      },
      required: ['items', 'totalItems', 'page', 'pageSize']
    };
  }

  if (isArraySchema(output)) {
    return output as Record<string, unknown>;
  }

  return {
    type: 'array',
    items: output
  };
};

const shouldIncludeRequestBody = (method: string, override?: boolean | RequestBodyMeta): boolean => {
  if (typeof override === 'boolean') return override;
  if (isRequestBodyMeta(override)) return true;
  return bodyMethods.has(method);
};

const buildRequestBody = (
  method: string,
  input: unknown,
  override?: boolean | RequestBodyMeta
): Record<string, unknown> | undefined => {
  if (!input) return undefined;
  if (!shouldIncludeRequestBody(method, override)) return undefined;

  const meta = isRequestBodyMeta(override) ? override : undefined;
  const contentType = meta?.contentType ?? 'application/json';

  return {
    required: meta?.required ?? true,
    ...(meta?.description ? { description: meta.description } : {}),
    content: {
      [contentType]: {
        schema: input
      }
    }
  };
};

const buildResponses = (
  meta: ResponseMeta[] | undefined,
  responseSchema: Record<string, unknown> | undefined
): Record<string, unknown> => {
  const responses: Record<string, unknown> = {};

  if (meta) {
    for (const entry of meta) {
      const key = String(entry.status);
      responses[key] = {
        description: entry.description ?? 'Response'
      };
    }
  }

  if (responseSchema) {
    const existing = responses['200'] as Record<string, unknown> | undefined;
    responses['200'] = {
      ...(existing ?? {}),
      description: (existing?.description as string | undefined) ?? 'OK',
      content: {
        'application/json': {
          schema: responseSchema
        }
      }
    };
  } else if (Object.keys(responses).length === 0) {
    responses['200'] = { description: 'OK' };
  }

  return responses;
};

export const buildOpenApiSpec = (
  registry: RouteRegistry,
  info: OpenApiInfo,
  options: OpenApiSpecOptions = {}
): OpenApiDocument => {
  const paths: Record<string, Record<string, unknown>> = {};
  let contractComponents: Record<string, unknown> | undefined;

  for (const route of registry.routes) {
    const contract = resolveContractRef(route.contract);
    const params = contract?.schemas?.parameters ?? [];
    const responseSchema = buildResponseSchema(contract?.mode, contract?.schemas?.output);
    const requestBody = buildRequestBody(route.method, contract?.schemas?.input, route.requestBody);
    const responses = buildResponses(route.responses, responseSchema);
    if (contract?.schemas?.components) {
      contractComponents = mergeOpenApiComponents(contractComponents, contract.schemas.components);
    }

    const operation: Record<string, unknown> = {
      summary: route.summary,
      deprecated: route.deprecated,
      tags: route.tags,
      parameters: params,
      responses,
      ...(requestBody ? { requestBody } : {})
    };

    if (!paths[route.fullPath]) {
      paths[route.fullPath] = {};
    }
    paths[route.fullPath][route.method] = operation;
  }

  const spec: OpenApiDocument = {
    openapi: '3.1.0',
    info,
    paths
  };

  if (contractComponents) {
    spec.components = mergeOpenApiComponents(spec.components, contractComponents);
  }

  const enhanced = applyOpenApiSpecEnhancers(spec, options);
  if (contractComponents && enhanced !== spec) {
    enhanced.components = mergeOpenApiComponents(enhanced.components, contractComponents);
  }
  return enhanced;
};

const applyOpenApiSpecEnhancers = (
  spec: OpenApiDocument,
  options: OpenApiSpecOptions = {}
): OpenApiDocument => {
  const enhancers: OpenApiSpecEnhancer[] = [];
  if (options.useDefaultEnhancers !== false) {
    enhancers.push(...defaultEnhancers);
  }
  if (options.enhance) {
    enhancers.push(...(Array.isArray(options.enhance) ? options.enhance : [options.enhance]));
  }
  if (enhancers.length === 0) return spec;
  let current = spec;
  for (const enhancer of enhancers) {
    const updated = enhancer(current);
    if (updated) {
      current = updated;
    }
  }
  return current;
};
