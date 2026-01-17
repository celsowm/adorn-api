import type { JsonSchema, SchemaBuildContext } from "./schema-builder";
import type { ControllerMeta, InputMeta, ResponseMeta } from "./metadata";
import type { Constructor, DtoConstructor } from "./types";
import {
  createSchemaContext,
  buildSchemaFromSource,
  ensureDtoComponent
} from "./schema-builder";
import { getAllControllers, getAllDtos, getDtoMeta } from "./metadata";
import type { SchemaNode, SchemaSource } from "./schema";

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface OpenApiOptions {
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  controllers?: Constructor[];
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  jsonSchemaDialect: string;
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, JsonSchema>;
  };
}

export function buildOpenApi(options: OpenApiOptions): OpenApiDocument {
  const context = createSchemaContext();
  for (const [dto] of getAllDtos()) {
    ensureDtoComponent(dto, context);
  }

  const controllers = filterControllers(options.controllers);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const controller of controllers) {
    const tagFallback = controller.meta.tags ?? [controller.meta.controller.name];
    for (const route of controller.meta.routes) {
      const fullPath = joinPaths(controller.meta.basePath, route.path);
      const openApiPath = expressPathToOpenApi(fullPath);
      const pathItem = (paths[openApiPath] ??= {});

      const parameters = [
        ...buildParameters("path", route.params, context),
        ...buildParameters("query", route.query, context),
        ...buildParameters("header", route.headers, context)
      ];

      const responses = buildResponses(route.responses, context);

      pathItem[route.httpMethod] = {
        operationId: `${controller.meta.controller.name}.${String(route.handlerName)}`,
        summary: route.summary,
        description: route.description,
        tags: route.tags ?? tagFallback,
        parameters: parameters.length ? parameters : undefined,
        requestBody: buildRequestBody(route.body, context),
        responses
      };
    }
  }

  return {
    openapi: "3.1.0",
    jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base",
    info: options.info,
    servers: options.servers,
    paths,
    components: {
      schemas: context.components
    }
  };
}

function buildRequestBody(
  body: InputMeta | undefined,
  context: SchemaBuildContext
): Record<string, unknown> | undefined {
  if (!body) {
    return undefined;
  }
  const contentType = body.contentType ?? "application/json";
  const schema = buildSchemaFromSource(body.schema, context);
  return {
    required: body.required ?? true,
    content: {
      [contentType]: { schema }
    }
  };
}

function buildResponses(
  responses: ResponseMeta[],
  context: SchemaBuildContext
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const response of responses) {
    const contentType = response.contentType ?? "application/json";
    output[String(response.status)] = {
      description: response.description ?? "OK",
      content: response.schema
        ? {
            [contentType]: {
              schema: buildSchemaFromSource(response.schema, context)
            }
          }
        : undefined
    };
  }
  return output;
}

function buildParameters(
  location: "path" | "query" | "header",
  input: InputMeta | undefined,
  context: SchemaBuildContext
): Array<Record<string, unknown>> {
  if (!input) {
    return [];
  }
  const fieldEntries = extractFields(input.schema);
  if (!fieldEntries.length) {
    return [];
  }
  return fieldEntries.map((entry) => ({
    name: entry.name,
    in: location,
    required: location === "path" ? true : entry.required,
    description: entry.description,
    schema: buildSchemaFromSource(entry.schema, context)
  }));
}

function extractFields(
  schema: SchemaSource
): Array<{ name: string; schema: SchemaSource; required: boolean; description?: string }> {
  if (isSchemaNode(schema)) {
    if (schema.kind === "object" && schema.properties) {
      const required = new Set(schema.required ?? []);
      return Object.entries(schema.properties).map(([name, value]) => ({
        name,
        schema: value,
        required: required.has(name),
        description: value.description
      }));
    }
    return [
      {
        name: "value",
        schema,
        required: !schema.optional,
        description: schema.description
      }
    ];
  }

  const dtoMeta = getDtoMetaSafe(schema);
  return Object.entries(dtoMeta.fields).map(([name, field]) => ({
    name,
    schema: field.schema,
    required: !(field.optional ?? field.schema.optional ?? false),
    description: field.description ?? field.schema.description
  }));
}

function getDtoMetaSafe(dto: DtoConstructor): {
  fields: Record<string, { schema: SchemaNode; optional?: boolean; description?: string }>;
} {
  const meta = getDtoMeta(dto);
  if (!meta) {
    throw new Error(`DTO "${dto.name}" is missing @Dto decorator.`);
  }
  return meta;
}

function filterControllers(
  controllers: Constructor[] | undefined
): Array<{ meta: ControllerMeta }> {
  const allControllers = getAllControllers();
  if (!controllers?.length) {
    return allControllers.map(([, meta]) => ({ meta }));
  }
  const set = new Set(controllers);
  return allControllers
    .filter(([controller]) => set.has(controller))
    .map(([, meta]) => ({ meta }));
}

function joinPaths(basePath: string, routePath: string): string {
  const base = basePath ? basePath.replace(/\/+$/, "") : "";
  const route = routePath ? routePath.replace(/^\/+/, "") : "";
  if (!base && !route) {
    return "/";
  }
  if (!base) {
    return `/${route}`;
  }
  if (!route) {
    return base.startsWith("/") ? base : `/${base}`;
  }
  return `${base.startsWith("/") ? base : `/${base}`}/${route}`;
}

function expressPathToOpenApi(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && "kind" in (value as SchemaNode);
}
