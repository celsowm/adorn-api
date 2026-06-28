import type { JsonSchema, SchemaBuildContext } from "./schema-builder";
import type { ControllerMeta, InputMeta, ResponseMeta, UploadedFileMeta } from "./metadata";
import type { Constructor, DtoConstructor } from "./types";
import {
  createSchemaContext,
  buildSchemaFromSource
} from "./schema-builder";
import { getAllControllers, getDtoMeta } from "./metadata";
import { getRouteAuthMeta } from "./auth";
import type { SchemaNode, SchemaSource } from "./schema";

/**
 * OpenAPI document information.
 */
export interface OpenApiInfo {
  /** API title */
  title: string;
  /** API version */
  version: string;
  /** API description */
  description?: string;
}

/**
 * OpenAPI server information.
 */
export interface OpenApiServer {
  /** Server URL */
  url: string;
  /** Server name */
  name?: string;
  /** Server description */
  description?: string;
}

/**
 * OpenAPI tag information.
 */
export interface OpenApiTag {
  /** Tag name */
  name: string;
  /** Short tag summary */
  summary?: string;
  /** Tag description */
  description?: string;
  /** Parent tag name for nested tag displays */
  parent?: string;
  /** Free-form tag kind such as "nav" or "audience" */
  kind?: string;
  /** Additional OpenAPI extension or future fields */
  [key: string]: unknown;
}

/**
 * Options for building OpenAPI documents.
 */
export interface OpenApiOptions {
  /** OpenAPI document information */
  info: OpenApiInfo;
  /** Self-assigned URI for this OpenAPI document */
  $self?: string;
  /** Array of servers */
  servers?: OpenApiServer[];
  /** Top-level OpenAPI tags */
  tags?: OpenApiTag[];
  /** Reusable OpenAPI components beyond generated schemas */
  components?: {
    mediaTypes?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
  /** Array of controllers to include */
  controllers?: Constructor[];
}

/**
 * OpenAPI document structure.
 */
export interface OpenApiDocument {
  /** OpenAPI specification version */
  openapi: "3.2.0";
  /** Self-assigned URI for this OpenAPI document */
  $self?: string;
  /** JSON Schema dialect */
  jsonSchemaDialect: string;
  /** API information */
  info: OpenApiInfo;
  /** API servers */
  servers?: OpenApiServer[];
  /** API tags */
  tags?: OpenApiTag[];
  /** API paths */
  paths: Record<string, Record<string, unknown>>;
  /** Reusable components */
  components: {
    /** Schema definitions */
    schemas: Record<string, JsonSchema>;
    /** Reusable media type definitions */
    mediaTypes?: Record<string, unknown>;
    /** Reusable security scheme definitions */
    securitySchemes?: Record<string, unknown>;
  };
}

/**
 * Builds an OpenAPI document from controllers.
 * @param options - OpenAPI build options
 * @returns OpenAPI document
 */
export function buildOpenApi(options: OpenApiOptions): OpenApiDocument {
  const context = createSchemaContext();
  
  const controllers = filterControllers(options.controllers);
  const paths: Record<string, Record<string, unknown>> = {};
  let hasBearerAuth = false;

  for (const controller of controllers) {
    const tagFallback = controller.meta.tags ?? [controller.meta.controller.name];
    for (const route of controller.meta.routes) {
      if (route.query && route.querystring) {
        throw new Error(`Route "${String(route.handlerName)}" cannot use both @Query and @QueryString.`);
      }
      const fullPath = joinPaths(controller.meta.basePath, route.path);
      const openApiPath = expressPathToOpenApi(fullPath);
      const pathItem = (paths[openApiPath] ??= {});

      const parameters = [
        ...buildParameters("path", route.params, context),
        ...buildParameters("query", route.query, context),
        ...buildQueryStringParameter(route.querystring, context),
        ...buildParameters("header", route.headers, context)
      ];

      const responses = buildResponses(route.responses, context);

      // Determine request body: file uploads use multipart, otherwise use regular body
      const hasFiles = route.files && route.files.length > 0;
      const requestBody = hasFiles
        ? buildMultipartRequestBody(route.files!, route.body, context)
        : buildRequestBody(route.body, context);
      const authMeta = getRouteAuthMeta(controller.meta.controller, route.handlerName);
      const security = authMeta?.requiresAuth && !authMeta.isPublic
        ? [{ bearerAuth: [] }]
        : undefined;

      if (security) {
        hasBearerAuth = true;
      }

      const operation = stripUndefined({
        operationId: `${controller.meta.controller.name}.${String(route.handlerName)}`,
        summary: route.summary,
        description: route.description,
        tags: route.tags ?? tagFallback,
        parameters: parameters.length ? parameters : undefined,
        requestBody,
        security,
        responses,
        ...route.operation
      });

      setPathOperation(pathItem, route.httpMethod, operation);
    }
  }

  const securitySchemes = {
    ...(hasBearerAuth
      ? {
          bearerAuth: {
            type: "http",
            scheme: "bearer"
          }
        }
      : {}),
    ...(options.components?.securitySchemes ?? {})
  };
  const components = stripUndefined({
    schemas: context.components,
    mediaTypes: options.components?.mediaTypes,
    securitySchemes: Object.keys(securitySchemes).length ? securitySchemes : undefined
  }) as OpenApiDocument["components"];

  return stripUndefined({
    openapi: "3.2.0",
    $self: options.$self,
    jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base",
    info: options.info,
    servers: options.servers,
    tags: options.tags,
    paths,
    components
  }) as OpenApiDocument;
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
      [contentType]: stripUndefined({ schema, ...body.mediaType })
    }
  };
}

function buildMultipartRequestBody(
  files: UploadedFileMeta[],
  body: InputMeta | undefined,
  context: SchemaBuildContext
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // Add file fields
  for (const file of files) {
    // Get description from file options first, then from schema
    const fileSchema = isSchemaNode(file.schema) ? file.schema : undefined;
    const description = file.description ?? fileSchema?.description;

    if (file.multiple) {
      properties[file.fieldName] = {
        type: "array",
        items: { type: "string", format: "binary" },
        description
      };
    } else {
      properties[file.fieldName] = {
        type: "string",
        format: "binary",
        description
      };
    }
    if (file.required) {
      required.push(file.fieldName);
    }
  }

  // Add body fields if present
  if (body) {
    const bodyFields = extractBodyFields(body.schema, context);
    for (const field of bodyFields) {
      properties[field.name] = buildSchemaFromSource(field.schema, context);
      if (field.required) {
        required.push(field.name);
      }
    }
  }

  return {
    required: required.length > 0,
    content: {
      "multipart/form-data": {
        schema: {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined
        }
      }
    }
  };
}

function extractBodyFields(
  schema: SchemaSource,
  _context: SchemaBuildContext
): Array<{ name: string; schema: SchemaSource; required: boolean }> {
  if (isSchemaNode(schema)) {
    if (schema.kind === "object" && schema.properties) {
      const requiredSet = new Set(schema.required ?? []);
      return Object.entries(schema.properties).map(([name, value]) => ({
        name,
        schema: value,
        required: requiredSet.has(name)
      }));
    }
    return [];
  }

  // Handle DTO reference
  const dtoMeta = getDtoMetaSafe(schema);
  return Object.entries(dtoMeta.fields).map(([name, field]) => ({
    name,
    schema: field.schema,
    required: !(field.optional ?? field.schema.optional ?? false)
  }));
}

function buildResponses(
  responses: ResponseMeta[],
  context: SchemaBuildContext
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const response of responses) {
    const contentType = response.contentType ?? "application/json";
    output[String(response.status)] = {
      summary: response.summary,
      description: response.description ?? getDefaultStatusDescription(response.status),
      content: response.schema || response.itemSchema
        ? {
            [contentType]: buildMediaTypeObject(response, context)
          }
        : undefined
    };
    output[String(response.status)] = stripUndefined(output[String(response.status)] as Record<string, unknown>);
  }
  return output;
}

function buildMediaTypeObject(
  response: ResponseMeta,
  context: SchemaBuildContext
): Record<string, unknown> {
  const itemSchema = response.itemSchema
    ? buildSchemaFromSource(response.itemSchema, context)
    : undefined;
  const schema = response.schema
    ? buildSchemaFromSource(response.schema, context)
    : itemSchema
      ? { type: "array", items: itemSchema }
      : undefined;

  return stripUndefined({
    schema,
    itemSchema,
    examples: response.examples,
    ...response.mediaType
  });
}

function getDefaultStatusDescription(status: number): string {
  switch (status) {
    case 200:
      return "OK";
    case 201:
      return "Created";
    case 202:
      return "Accepted";
    case 204:
      return "No Content";
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 422:
      return "Unprocessable Entity";
    case 500:
      return "Internal Server Error";
    case 503:
      return "Service Unavailable";
    default:
      return "OK";
  }
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
  return fieldEntries.map((entry) => {
    const param: Record<string, unknown> = {
      name: entry.name,
      in: location,
      required: location === "path" ? true : entry.required,
      description: entry.description,
      schema: buildSchemaFromSource(entry.schema, context)
    };

    if (location === "query" && isSchemaNode(entry.schema)) {
      if (entry.schema.kind === "array") {
        param.style = "form";
        param.explode = true;
      } else if (entry.schema.kind === "object") {
        param.style = "deepObject";
        param.explode = true;
      }

      if (entry.schema.examples && entry.schema.examples.length > 0) {
        param.example = entry.schema.examples[0];
      }
    }

    return param;
  });
}

function buildQueryStringParameter(
  input: InputMeta | undefined,
  context: SchemaBuildContext
): Array<Record<string, unknown>> {
  if (!input) {
    return [];
  }
  const contentType = input.contentType ?? "application/x-www-form-urlencoded";
  return [
    stripUndefined({
      name: "querystring",
      in: "querystring",
      required: input.required ?? false,
      description: input.description,
      content: {
        [contentType]: stripUndefined({
          schema: buildSchemaFromSource(input.schema, context),
          ...input.mediaType
        })
      }
    })
  ];
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

function setPathOperation(
  pathItem: Record<string, unknown>,
  method: string,
  operation: Record<string, unknown>
): void {
  const lower = method.toLowerCase();
  if (isFixedPathItemMethod(lower)) {
    pathItem[lower] = operation;
    return;
  }

  const additionalOperations = (pathItem.additionalOperations ??= {}) as Record<string, unknown>;
  additionalOperations[method] = operation;
}

function isFixedPathItemMethod(method: string): boolean {
  return [
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
    "query"
  ].includes(method);
}

function stripUndefined<T extends Record<string, unknown>>(object: T): T {
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined) {
      delete object[key];
    }
  }
  return object;
}
