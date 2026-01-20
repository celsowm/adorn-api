import express, { type Request, type Response, type NextFunction } from "express";
import { buildOpenApi, type OpenApiInfo, type OpenApiServer } from "../core/openapi";
import type { Constructor, DtoConstructor } from "../core/types";
import { getControllerMeta, getDtoMeta, type InputMeta } from "../core/metadata";
import type {
  SchemaNode,
  SchemaSource,
  ArraySchema,
  NumberSchema,
  ObjectSchema,
  RecordSchema,
  RefSchema,
  UnionSchema
} from "../core/schema";
import { coerce } from "../core/coerce";
import { HttpError, isHttpError } from "../core/errors";

/**
 * Request context provided to route handlers.
 */
export interface RequestContext<
  TBody = unknown,
  TQuery extends object | undefined = Record<string, unknown>,
  TParams extends object | undefined = Record<string, string | number | boolean | undefined>,
  THeaders extends object | undefined = Record<string, string | string[] | undefined>
> {
  /** Express request object */
  req: Request;
  /** Express response object */
  res: Response;
  /** Parsed request body */
  body: TBody;
  /** Parsed query parameters */
  query: TQuery;
  /** Parsed path parameters */
  params: TParams;
  /** Request headers */
  headers: THeaders;
}

/**
 * Input coercion modes.
 */
export type InputCoercionMode = "safe" | "strict";

/**
 * Input coercion setting - can be a mode or disabled.
 */
export type InputCoercionSetting = InputCoercionMode | false;

/**
 * Options for creating an Express application adapter.
 */
export interface ExpressAdapterOptions {
  /** Array of controller classes */
  controllers: Constructor[];
  /** Whether to enable JSON body parsing */
  jsonBody?: boolean;
  /** OpenAPI configuration */
  openApi?: OpenApiExpressOptions;
  /** Input coercion setting */
  inputCoercion?: InputCoercionSetting;
}

/**
 * Creates an Express application with Adorn controllers.
 * @param options - Express adapter options
 * @returns Configured Express application
 */
export function createExpressApp(options: ExpressAdapterOptions): express.Express {
  const app = express();
  if (options.jsonBody ?? true) {
    app.use(express.json());
  }
  const inputCoercion = options.inputCoercion ?? "safe";
  attachControllers(app, options.controllers, inputCoercion);
  if (options.openApi) {
    attachOpenApi(app, options.controllers, options.openApi);
  }
  return app;
}

/**
 * Options for OpenAPI documentation UI.
 */
export interface OpenApiDocsOptions {
  /** Path for documentation UI */
  path?: string;
  /** Title for documentation page */
  title?: string;
  /** URL for Swagger UI assets */
  swaggerUiUrl?: string;
}

/**
 * OpenAPI configuration for Express adapter.
 */
export interface OpenApiExpressOptions {
  /** OpenAPI document info */
  info: OpenApiInfo;
  /** Array of servers */
  servers?: OpenApiServer[];
  /** Path for OpenAPI JSON endpoint */
  path?: string;
  /** Documentation UI configuration */
  docs?: boolean | OpenApiDocsOptions;
}

/**
 * Attaches controllers to an Express application.
 * @param app - Express application instance
 * @param controllers - Array of controller classes
 * @param inputCoercion - Input coercion setting
 */
export function attachControllers(
  app: express.Express,
  controllers: Constructor[],
  inputCoercion: InputCoercionSetting = "safe"
): void {
  for (const controller of controllers) {
    const meta = getControllerMeta(controller);
    if (!meta) {
      throw new Error(`Controller "${controller.name}" is missing @Controller decorator.`);
    }
    const instance = new controller();
    for (const route of meta.routes) {
      const path = joinPaths(meta.basePath, route.path);
      const handler = instance[route.handlerName as keyof typeof instance];
      if (typeof handler !== "function") {
        throw new Error(`Handler "${String(route.handlerName)}" is not a function on ${controller.name}.`);
      }
      const coerceParams = inputCoercion === false
        ? undefined
        : createInputCoercer<Record<string, string | number | boolean | undefined>>(
          route.params,
          { mode: inputCoercion, location: "params" }
        );
      const coerceQuery = inputCoercion === false
        ? undefined
        : createInputCoercer(route.query, { mode: inputCoercion, location: "query" });
      app[route.httpMethod](path, async (req: Request, res: Response, next: NextFunction) => {
        try {
          const ctx: RequestContext = {
            req,
            res,
            body: req.body,
            query: coerceQuery ? coerceQuery(req.query) : req.query,
            params: coerceParams ? coerceParams(req.params) : req.params,
            headers: req.headers
          };
          const result = await handler.call(instance, ctx);
          if (res.headersSent) {
            return;
          }
          if (result === undefined) {
            res.status(defaultStatus(route)).end();
            return;
          }
          res.status(defaultStatus(route)).json(result);
        } catch (error) {
          if (isHttpError(error)) {
            sendHttpError(res, error);
            return;
          }
          next(error);
        }
      });
    }
  }
}

function attachOpenApi(
  app: express.Express,
  controllers: Constructor[],
  options: OpenApiExpressOptions
): void {
  const openApiPath = normalizePath(options.path, "/openapi.json");
  const document = buildOpenApi({
    info: options.info,
    servers: options.servers,
    controllers
  });

  app.get(openApiPath, (_req, res) => {
    res.json(document);
  });

  if (!options.docs) {
    return;
  }

  const docsOptions = typeof options.docs === "object" ? options.docs : {};
  const docsPath = normalizePath(docsOptions.path, "/docs");
  const title = docsOptions.title ?? `${options.info.title} Docs`;
  const swaggerUiUrl = (docsOptions.swaggerUiUrl ?? "https://unpkg.com/swagger-ui-dist@5").replace(
    /\/+$/,
    ""
  );

  const html = buildSwaggerUiHtml({ title, swaggerUiUrl, openApiPath });
  app.get(docsPath, (_req, res) => {
    res.type("html").send(html);
  });
}

function buildSwaggerUiHtml(options: {
  title: string;
  swaggerUiUrl: string;
  openApiPath: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${options.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${options.swaggerUiUrl}/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f6f6f6;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${options.swaggerUiUrl}/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "${options.openApiPath}",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout"
        });
      };
    </script>
  </body>
</html>`;
}

function defaultStatus(route: {
  responses?: Array<{ status: number; error?: boolean }>;
}): number {
  const responses = route.responses ?? [];
  const success = responses.find(
    (response) => !response.error && response.status < 400
  );
  return success?.status ?? 200;
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

function normalizePath(path: string | undefined, fallback: string): string {
  const value = path && path.trim().length ? path.trim() : fallback;
  return value.startsWith("/") ? value : `/${value}`;
}

function sendHttpError(res: Response, error: HttpError): void {
  if (res.headersSent) {
    return;
  }
  if (error.headers) {
    for (const [key, value] of Object.entries(error.headers)) {
      res.setHeader(key, value);
    }
  }
  const body = error.body ?? { message: error.message };
  if (body === undefined) {
    res.status(error.status).end();
    return;
  }
  res.status(error.status).json(body);
}

type CoerceField = { name: string; schema: SchemaNode };
type InputLocation = "params" | "query";

interface InputCoercionOptions {
  mode: InputCoercionMode;
  location: InputLocation;
}

interface CoerceOutcome {
  value: unknown;
  ok: boolean;
  changed: boolean;
}

function createInputCoercer<T extends Record<string, unknown> = Record<string, unknown>>(
  input: InputMeta | undefined,
  options: InputCoercionOptions
): ((value: T) => T) | undefined {
  if (!input) {
    return undefined;
  }
  const fields = extractFields(input.schema);
  if (!fields.length) {
    return undefined;
  }
  return (value: T) => {
    const result = coerceRecord(value, fields, options.mode);
    if (options.mode === "strict" && result.invalidFields.length) {
      throw new HttpError(400, buildInvalidMessage(options.location, result.invalidFields));
    }
    return result.value as T;
  };
}

function coerceRecord(
  value: unknown,
  fields: CoerceField[],
  mode: InputCoercionMode
): { value: unknown; invalidFields: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value, invalidFields: [] };
  }
  const input = value as Record<string, unknown>;
  let changed = false;
  const output: Record<string, unknown> = { ...input };
  const invalidFields: string[] = [];
  for (const field of fields) {
    if (!(field.name in input)) {
      continue;
    }
    const original = input[field.name];
    const result = coerceValue(original, field.schema, mode);
    if (!result.ok && mode === "strict") {
      invalidFields.push(field.name);
    }
    if (result.changed) {
      output[field.name] = result.value;
      changed = true;
    }
  }
  return { value: changed ? output : value, invalidFields };
}

function coerceValue(
  value: unknown,
  schema: SchemaNode,
  mode: InputCoercionMode
): CoerceOutcome {
  switch (schema.kind) {
    case "integer":
      return coerceNumber(value, schema, true);
    case "number":
      return coerceNumber(value, schema, false);
    case "boolean": {
      return coerceBoolean(value);
    }
    case "string": {
      return coerceString(value);
    }
    case "array":
      return coerceArrayValue(value, schema, mode);
    case "object":
      return coerceObjectValue(value, schema, mode);
    case "record":
      return coerceRecordValue(value, schema, mode);
    case "ref":
      return coerceRefValue(value, schema, mode);
    case "union":
      return coerceUnionValue(value, schema, mode);
    default:
      return { value, ok: true, changed: false };
  }
}

function coerceNumber(value: unknown, schema: NumberSchema, integer: boolean): CoerceOutcome {
  if (!isPresent(value)) {
    return { value, ok: true, changed: false };
  }
  const parsed = integer
    ? coerce.integer(value, { min: schema.minimum, max: schema.maximum })
    : coerce.number(value, { min: schema.minimum, max: schema.maximum });
  if (parsed === undefined) {
    return { value, ok: false, changed: false };
  }
  if (schema.exclusiveMinimum !== undefined && parsed <= schema.exclusiveMinimum) {
    return { value, ok: false, changed: false };
  }
  if (schema.exclusiveMaximum !== undefined && parsed >= schema.exclusiveMaximum) {
    return { value, ok: false, changed: false };
  }
  return { value: parsed, ok: true, changed: parsed !== value };
}

function coerceBoolean(value: unknown): CoerceOutcome {
  if (!isPresent(value)) {
    return { value, ok: true, changed: false };
  }
  const parsed = coerce.boolean(value);
  if (parsed === undefined) {
    return { value, ok: false, changed: false };
  }
  return { value: parsed, ok: true, changed: parsed !== value };
}

function coerceString(value: unknown): CoerceOutcome {
  const parsed = coerce.string(value);
  if (parsed === undefined) {
    return { value, ok: true, changed: false };
  }
  return { value: parsed, ok: true, changed: parsed !== value };
}

function coerceArrayValue(
  value: unknown,
  schema: ArraySchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  const input = Array.isArray(value) ? value : [value];
  let changed = !Array.isArray(value);
  let ok = true;
  const output = input.map((entry) => {
    const result = coerceValue(entry, schema.items, mode);
    if (!result.ok) {
      ok = false;
    }
    if (result.changed) {
      changed = true;
    }
    return result.value;
  });
  return { value: changed ? output : value, ok, changed };
}

function coerceObjectValue(
  value: unknown,
  schema: ObjectSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value, ok: mode === "safe", changed: false };
  }
  const properties = schema.properties ?? {};
  const fields = Object.entries(properties).map(([name, fieldSchema]) => ({
    name,
    schema: fieldSchema
  }));
  if (!fields.length) {
    return { value, ok: true, changed: false };
  }
  const result = coerceRecord(value, fields, mode);
  return {
    value: result.value,
    ok: result.invalidFields.length === 0,
    changed: result.value !== value
  };
}

function coerceRecordValue(
  value: unknown,
  schema: RecordSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value, ok: mode === "safe", changed: false };
  }
  const input = value as Record<string, unknown>;
  let changed = false;
  let ok = true;
  const output: Record<string, unknown> = { ...input };
  for (const [key, entry] of Object.entries(input)) {
    const result = coerceValue(entry, schema.values, mode);
    if (!result.ok) {
      ok = false;
    }
    if (result.changed) {
      output[key] = result.value;
      changed = true;
    }
  }
  return { value: changed ? output : value, ok, changed };
}

function coerceRefValue(
  value: unknown,
  schema: RefSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value, ok: mode === "safe", changed: false };
  }
  const meta = getDtoMetaSafe(schema.dto);
  const fields = Object.entries(meta.fields).map(([name, field]) => ({
    name,
    schema: field.schema
  }));
  if (!fields.length) {
    return { value, ok: true, changed: false };
  }
  const result = coerceRecord(value, fields, mode);
  return {
    value: result.value,
    ok: result.invalidFields.length === 0,
    changed: result.value !== value
  };
}

function coerceUnionValue(
  value: unknown,
  schema: UnionSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  let fallback: CoerceOutcome | undefined;
  for (const option of schema.anyOf) {
    const result = coerceValue(value, option, mode);
    if (!result.ok) {
      continue;
    }
    if (result.changed) {
      return result;
    }
    fallback ??= result;
  }
  if (fallback) {
    return fallback;
  }
  return { value, ok: mode === "safe", changed: false };
}

function extractFields(schema: SchemaSource): CoerceField[] {
  if (isSchemaNode(schema)) {
    if (schema.kind === "object" && schema.properties) {
      return Object.entries(schema.properties).map(([name, fieldSchema]) => ({
        name,
        schema: fieldSchema
      }));
    }
    return [];
  }
  const meta = getDtoMetaSafe(schema);
  return Object.entries(meta.fields).map(([name, field]) => ({
    name,
    schema: field.schema
  }));
}

function getDtoMetaSafe(dto: DtoConstructor): {
  fields: Record<string, { schema: SchemaNode }>;
} {
  const meta = getDtoMeta(dto);
  if (!meta) {
    throw new Error(`DTO "${dto.name}" is missing @Dto decorator.`);
  }
  return meta;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && "kind" in (value as SchemaNode);
}

function isPresent(value: unknown): boolean {
  return coerce.string(value) !== undefined;
}

function buildInvalidMessage(location: InputLocation, fields: string[]): string {
  const label = location === "params" ? "path parameter" : "query parameter";
  const suffix = fields.length > 1 ? "s" : "";
  return `Invalid ${label}${suffix}: ${fields.join(", ")}.`;
}
