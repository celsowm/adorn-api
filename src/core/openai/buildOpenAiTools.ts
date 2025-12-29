import type { RouteOptions, ScalarHint } from '../../contracts/route-options.js';
import type { Registry, RouteEntry } from '../registry/types.js';
import { conventionForMethod } from '../binding/rules/inferFromHttpMethod.js';
import { getPathTokenNames } from '../binding/rules/inferFromPath.js';
import { schemaToJsonSchema, irToJsonSchema } from '../jsonschema/toJsonSchema.js';
import type { JsonSchema } from '../jsonschema/toJsonSchema.js';

type RouteOptionsAny = RouteOptions<string>;

export type OpenAiFunctionTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: JsonSchema;
  };
};

export type OpenAiToolRouteInfo = {
  method: RouteEntry['method'];
  path: string;
  operationId: string;
};

export type OpenAiToolset = {
  tools: OpenAiFunctionTool[];
  routesByToolName: Record<string, OpenAiToolRouteInfo>;
};

export type BuildOpenAiToolsOptions = {
  includeQueryObject?: boolean;
  includeBody?: boolean;
};

const PATH_HINTS_JSON: Record<ScalarHint, JsonSchema> = {
  boolean: { type: 'boolean' },
  int: { type: 'integer' },
  number: { type: 'number' },
  string: { type: 'string' },
  uuid: { type: 'string', format: 'uuid' },
};

function jsonSchemaFromHint(hint?: ScalarHint): JsonSchema {
  if (hint && PATH_HINTS_JSON[hint]) return PATH_HINTS_JSON[hint];
  return { type: 'string' };
}

function mergedPathHints(route: RouteEntry, ro: RouteOptionsAny): Record<string, ScalarHint | undefined> {
  const optionHints = ro.bindings?.path ?? {};
  const metaHints = route.bindings?.byMethod?.[route.handlerName]?.path ?? {};
  return { ...optionHints, ...metaHints };
}

function sanitizeToolName(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}_${i}`)) i++;
  const out = `${base}_${i}`;
  used.add(out);
  return out;
}

export function buildOpenAiTools(registry: Registry, opts: BuildOpenAiToolsOptions = {}): OpenAiToolset {
  const includeQueryObject = opts.includeQueryObject ?? true;
  const includeBody = opts.includeBody ?? true;

  const used = new Set<string>();

  const tools: OpenAiFunctionTool[] = [];
  const routesByToolName: Record<string, OpenAiToolRouteInfo> = {};

  for (const r of registry.routes) {
    const ro = (r.options ?? {}) as RouteOptionsAny;
    const operationId = ro.operationId ?? `${r.controller.name}.${r.handlerName}`;

    const toolName = uniqueName(sanitizeToolName(operationId), used);

    const parameters = buildParametersSchema(r, ro, { includeQueryObject, includeBody });

    tools.push({
      type: 'function',
      function: {
        name: toolName,
        ...(ro.summary ? { description: ro.summary } : ro.description ? { description: ro.description } : {}),
        parameters,
      },
    });

    routesByToolName[toolName] = {
      method: r.method,
      path: r.fullPath,
      operationId,
    };
  }

  return { tools, routesByToolName };
}

function buildParametersSchema(
  r: RouteEntry,
  ro: RouteOptionsAny,
  flags: { includeQueryObject: boolean; includeBody: boolean },
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  const tokenNames = getPathTokenNames(r.fullPath);
  if (tokenNames.length) {
    const hints = mergedPathHints(r, ro);
    const paramsSchema = ro.validate?.params;

    for (const name of tokenNames) {
      if (paramsSchema?.ir.kind === 'object' && paramsSchema.ir.properties[name]) {
        const propIr = paramsSchema.ir.properties[name];
        properties[name] = irToJsonSchema(propIr);
      } else {
        properties[name] = jsonSchemaFromHint(hints[name]);
      }
      required.push(name);
    }
  }

  const conv = conventionForMethod(r.method);

  if (flags.includeQueryObject && (conv.primary === 'query' || conv.secondary === 'query')) {
    const q = ro.validate?.query;
    if (q) {
      properties.query = schemaToJsonSchema(q);
    }
  }

  if (flags.includeBody && (conv.primary === 'body' || conv.secondary === 'body')) {
    const b = ro.validate?.body;
    if (b) {
      properties.body = schemaToJsonSchema(b);
      if (b.ir.kind !== 'optional') required.push('body');
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}
