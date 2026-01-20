import type { SchemaNode, SchemaSource } from "./schema";
import type { Constructor, DtoConstructor, HttpMethod } from "./types";
import {
  getAdornMetadata,
  getDtoMeta,
  registerController,
  registerDto,
  type ControllerMeta,
  type DecoratorMetadata,
  type DtoMeta,
  type FieldMeta,
  type InputMeta,
  type ResponseMeta,
  type RouteMeta,
  type RouteMetaInput
} from "./metadata";

/**
 * Options for configuring a Data Transfer Object (DTO).
 */
export interface DtoOptions {
  /** Custom name for the DTO */
  name?: string;
  /** Description of the DTO */
  description?: string;
  /** Whether to allow additional properties not defined in the schema */
  additionalProperties?: boolean;
}

/**
 * Options for composing DTOs from existing DTOs.
 * @extends DtoOptions
 */
export interface DtoComposeOptions extends DtoOptions {
  /** Field overrides for the composed DTO */
  overrides?: Record<string, FieldOverride>;
}

/**
 * Options for overriding field definitions.
 */
export interface FieldOverrideOptions {
  /** Schema definition for the field */
  schema?: SchemaNode;
  /** Whether the field is optional */
  optional?: boolean;
  /** Description of the field */
  description?: string;
}

/**
 * Field override definition - can be either a schema node or override options.
 */
export type FieldOverride = SchemaNode | FieldOverrideOptions;

/**
 * Options for defining a field in a DTO.
 */
export interface FieldOptions {
  /** Schema definition for the field */
  schema: SchemaNode;
  /** Whether the field is optional */
  optional?: boolean;
  /** Description of the field */
  description?: string;
}

/**
 * Options for configuring a controller.
 */
export interface ControllerOptions {
  /** Base path for the controller */
  path?: string;
  /** Tags for OpenAPI documentation */
  tags?: string[];
}

/**
 * Options for documenting routes.
 */
export interface DocOptions {
  /** Summary of the route */
  summary?: string;
  /** Detailed description of the route */
  description?: string;
  /** Tags for OpenAPI documentation */
  tags?: string[];
}

/**
 * Options for input parameters.
 */
export interface InputOptions {
  /** Description of the input */
  description?: string;
  /** Whether the input is required */
  required?: boolean;
  /** Content type for the input */
  contentType?: string;
}

/**
 * Options for return responses.
 */
export interface ReturnsOptions {
  /** HTTP status code */
  status?: number;
  /** Schema for the response body */
  schema?: SchemaSource;
  /** Description of the response */
  description?: string;
  /** Content type for the response */
  contentType?: string;
}

/**
 * Options for error responses.
 * @extends Omit<ReturnsOptions, "schema" | "status">
 */
export interface ErrorResponseOptions
  extends Omit<ReturnsOptions, "schema" | "status"> {
  /** HTTP status code for the error */
  status: number;
}

/**
 * Decorator for defining Data Transfer Objects (DTOs).
 * @param options - Configuration options for the DTO
 * @returns Class decorator function
 */
export function Dto(options: DtoOptions = {}) {
  return (value: DtoConstructor, context: ClassDecoratorContext): void => {
    const meta = getAdornMetadata(context.metadata as DecoratorMetadata);
    const fields = meta.dtoFields ?? {};
    const dtoMeta: DtoMeta = {
      name: options.name ?? value.name,
      description: options.description,
      fields,
      additionalProperties: options.additionalProperties
    };
    registerDto(value, dtoMeta);
  };
}

/**
 * Creates a new DTO by picking specific fields from an existing DTO.
 * @param dto - Source DTO to pick fields from
 * @param keys - Array of field names to include
 * @param options - Composition options
 * @returns Class decorator function
 */
export function PickDto(
  dto: DtoConstructor,
  keys: string[],
  options: DtoComposeOptions = {}
) {
  return (value: DtoConstructor, _context: ClassDecoratorContext): void => {
    const dtoMeta = getDtoMetaOrThrow(dto);
    const fields = pickFields(dtoMeta.fields, keys);
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value, buildDerivedMeta(value, dtoMeta, mergedFields, options));
  };
}

/**
 * Creates a new DTO by omitting specific fields from an existing DTO.
 * @param dto - Source DTO to omit fields from
 * @param keys - Array of field names to exclude
 * @param options - Composition options
 * @returns Class decorator function
 */
export function OmitDto(
  dto: DtoConstructor,
  keys: string[],
  options: DtoComposeOptions = {}
) {
  return (value: DtoConstructor, _context: ClassDecoratorContext): void => {
    const dtoMeta = getDtoMetaOrThrow(dto);
    const fields = omitFields(dtoMeta.fields, keys);
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value, buildDerivedMeta(value, dtoMeta, mergedFields, options));
  };
}

/**
 * Creates a new DTO by making all fields optional from an existing DTO.
 * @param dto - Source DTO to make fields optional
 * @param options - Composition options
 * @returns Class decorator function
 */
export function PartialDto(dto: DtoConstructor, options: DtoComposeOptions = {}) {
  return (value: DtoConstructor, _context: ClassDecoratorContext): void => {
    const dtoMeta = getDtoMetaOrThrow(dto);
    const fields = makeFieldsPartial(dtoMeta.fields);
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value, buildDerivedMeta(value, dtoMeta, mergedFields, options));
  };
}

/**
 * Creates a new DTO by merging multiple existing DTOs.
 * @param dtos - Array of DTOs to merge
 * @param options - Composition options
 * @returns Class decorator function
 */
export function MergeDto(dtos: DtoConstructor[], options: DtoComposeOptions = {}) {
  return (value: DtoConstructor, _context: ClassDecoratorContext): void => {
    if (!dtos.length) {
      throw new Error("MergeDto requires at least one DTO.");
    }
    const metas = dtos.map(getDtoMetaOrThrow);
    const fields = mergeFields(metas.map((meta) => meta.fields));
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value, buildDerivedMeta(value, metas[0], mergedFields, options));
  };
}

/**
 * Decorator for defining fields in a DTO.
 * @param schemaOrOptions - Schema definition or field options
 * @returns Property decorator function
 */
export function Field(schemaOrOptions: SchemaNode | FieldOptions) {
  return (_value: unknown, context: ClassFieldDecoratorContext): void => {
    if (typeof context.name !== "string") {
      throw new Error("Field decorator only supports string property keys.");
    }
    const meta = getAdornMetadata(context.metadata as DecoratorMetadata);
    const fields = meta.dtoFields ?? (meta.dtoFields = {});
    fields[context.name] = normalizeField(schemaOrOptions);
  };
}

/**
 * Decorator for defining API controllers.
 * @param pathOrOptions - Base path or controller options
 * @returns Class decorator function
 */
export function Controller(pathOrOptions: string | ControllerOptions = {}) {
  return (value: Constructor, context: ClassDecoratorContext): void => {
    const options =
      typeof pathOrOptions === "string" ? { path: pathOrOptions } : pathOrOptions;
    const meta = getAdornMetadata(context.metadata as DecoratorMetadata);
    const routes = meta.routes ?? [];
    const controllerMeta: ControllerMeta = {
      basePath: normalizePath(options.path ?? ""),
      controller: value as Constructor,
      routes: routes.map(finalizeRoute),
      tags: options.tags
    };
    registerController(controllerMeta);
  };
}

/**
 * Decorator for adding documentation to route handlers.
 * @param options - Documentation options
 * @returns Method decorator function
 */
export function Doc(options: DocOptions) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.summary = options.summary;
    route.description = options.description;
    route.tags = options.tags;
  };
}

/**
 * Decorator for GET HTTP method routes.
 * @param path - Route path
 * @returns Method decorator function
 */
export function Get(path = "") {
  return Route("get", path);
}

/**
 * Decorator for POST HTTP method routes.
 * @param path - Route path
 * @returns Method decorator function
 */
export function Post(path = "") {
  return Route("post", path);
}

/**
 * Decorator for PUT HTTP method routes.
 * @param path - Route path
 * @returns Method decorator function
 */
export function Put(path = "") {
  return Route("put", path);
}

/**
 * Decorator for PATCH HTTP method routes.
 * @param path - Route path
 * @returns Method decorator function
 */
export function Patch(path = "") {
  return Route("patch", path);
}

/**
 * Decorator for DELETE HTTP method routes.
 * @param path - Route path
 * @returns Method decorator function
 */
export function Delete(path = "") {
  return Route("delete", path);
}

/**
 * Decorator for defining request body schema.
 * @param schema - Schema for the request body
 * @param options - Input options
 * @returns Method decorator function
 */
export function Body(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.body = buildInputMeta(schema, options);
  };
}

/**
 * Decorator for defining query parameter schema.
 * @param schema - Schema for query parameters
 * @param options - Input options
 * @returns Method decorator function
 */
export function Query(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.query = buildInputMeta(schema, options);
  };
}

/**
 * Decorator for defining path parameter schema.
 * @param schema - Schema for path parameters
 * @param options - Input options
 * @returns Method decorator function
 */
export function Params(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.params = buildInputMeta(schema, options);
  };
}

/**
 * Decorator for defining request header schema.
 * @param schema - Schema for request headers
 * @param options - Input options
 * @returns Method decorator function
 */
export function Headers(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.headers = buildInputMeta(schema, options);
  };
}

/**
 * Decorator for defining successful return responses.
 * @param schemaOrOptions - Response schema or options
 * @param options - Additional response options
 * @returns Method decorator function
 */
export function Returns(
  schemaOrOptions: SchemaSource | ReturnsOptions = {},
  options: Omit<ReturnsOptions, "schema"> = {}
){
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    const response = normalizeReturns(schemaOrOptions, options);
    route.responses.push(response);
  };
}

/**
 * Decorator for defining error return responses.
 * @param schemaOrOptions - Error response schema or options
 * @param options - Additional response options
 * @returns Method decorator function
 */
export function ReturnsError(
  schemaOrOptions: SchemaSource | ReturnsOptions = {},
  options: Omit<ReturnsOptions, "schema"> = {}
) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    const response = normalizeReturns(schemaOrOptions, options);
    response.status = response.status >= 400 ? response.status : 400;
    response.error = true;
    route.responses.push(response);
  };
}

/**
 * Decorator for defining multiple error responses.
 * @param schema - Schema for error responses
 * @param responses - Array of error response options
 * @returns Method decorator function
 */
export function Errors(schema: SchemaSource, responses: ErrorResponseOptions[]) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    if (!responses.length) {
      throw new Error("Errors decorator requires at least one response.");
    }
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    for (const response of responses) {
      route.responses.push({
        status: response.status,
        schema,
        description: response.description,
        contentType: response.contentType,
        error: true
      });
    }
  };
}

function Route(method: HttpMethod, path: string) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.httpMethod = method;
    route.path = path;
  };
}

function normalizeField(schemaOrOptions: SchemaNode | FieldOptions): FieldMeta {
  if (isSchemaNode(schemaOrOptions)) {
    return { schema: schemaOrOptions, optional: schemaOrOptions.optional };
  }
  return {
    schema: schemaOrOptions.schema,
    optional: schemaOrOptions.optional ?? schemaOrOptions.schema.optional,
    description: schemaOrOptions.description
  };
}

function buildInputMeta(schema: SchemaSource, options: InputOptions): InputMeta {
  return {
    schema,
    description: options.description,
    required: options.required,
    contentType: options.contentType
  };
}

function normalizeReturns(
  schemaOrOptions: SchemaSource | ReturnsOptions,
  options: Omit<ReturnsOptions, "schema">
): ResponseMeta {
  if (isSchemaNode(schemaOrOptions) || isDtoConstructor(schemaOrOptions)) {
    return {
      status: options.status ?? 200,
      schema: schemaOrOptions,
      description: options.description,
      contentType: options.contentType
    };
  }
  return {
    status: schemaOrOptions.status ?? 200,
    schema: schemaOrOptions.schema,
    description: schemaOrOptions.description,
    contentType: schemaOrOptions.contentType
  };
}

function getRoute(metadata: DecoratorMetadata, name: string | symbol): RouteMetaInput {
  const meta = getAdornMetadata(metadata);
  const routes = meta.routes ?? (meta.routes = []);
  let route = routes.find((entry) => entry.handlerName === name);
  if (!route) {
    route = {
      handlerName: name,
      responses: []
    };
    routes.push(route);
  }
  return route;
}

function finalizeRoute(route: RouteMetaInput): RouteMeta {
  if (!route.httpMethod) {
    throw new Error(`Missing HTTP method decorator on route "${String(route.handlerName)}".`);
  }
  if (route.path === undefined) {
    throw new Error(`Missing path for route "${String(route.handlerName)}".`);
  }
  if (!route.responses.length) {
    route.responses.push({ status: 200, description: "OK" });
  }
  return {
    ...route,
    httpMethod: route.httpMethod,
    path: route.path,
    responses: route.responses
  };
}

function normalizePath(path: string): string {
  if (!path) {
    return "";
  }
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && "kind" in (value as SchemaNode);
}

function isDtoConstructor(value: unknown): value is DtoConstructor {
  return typeof value === "function";
}

function getDtoMetaOrThrow(dto: DtoConstructor): DtoMeta {
  const dtoMeta = getDtoMeta(dto);
  if (!dtoMeta) {
    throw new Error(`DTO "${dto.name}" is missing @Dto decorator.`);
  }
  return dtoMeta;
}

function buildDerivedMeta(
  value: Constructor,
  baseMeta: DtoMeta,
  fields: Record<string, FieldMeta>,
  options: DtoComposeOptions
): DtoMeta {
  const name = options.name ?? value.name;
  return {
    name,
    description: options.description ?? baseMeta.description,
    fields,
    additionalProperties: options.additionalProperties ?? baseMeta.additionalProperties
  };
}

function pickFields(fields: Record<string, FieldMeta>, keys: string[]): Record<string, FieldMeta> {
  const output: Record<string, FieldMeta> = {};
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const field = fields[key];
    if (!field) {
      throw new Error(`DTO field "${key}" does not exist.`);
    }
    output[key] = cloneField(field);
  }
  return output;
}

function omitFields(fields: Record<string, FieldMeta>, keys: string[]): Record<string, FieldMeta> {
  const omitSet = new Set(keys);
  for (const key of omitSet) {
    if (!fields[key]) {
      throw new Error(`DTO field "${key}" does not exist.`);
    }
  }
  const output: Record<string, FieldMeta> = {};
  for (const [name, field] of Object.entries(fields)) {
    if (!omitSet.has(name)) {
      output[name] = cloneField(field);
    }
  }
  return output;
}

function makeFieldsPartial(fields: Record<string, FieldMeta>): Record<string, FieldMeta> {
  const output: Record<string, FieldMeta> = {};
  for (const [name, field] of Object.entries(fields)) {
    output[name] = { ...cloneField(field), optional: true };
  }
  return output;
}

function mergeFields(
  sources: Array<Record<string, FieldMeta>>
): Record<string, FieldMeta> {
  const output: Record<string, FieldMeta> = {};
  for (const fields of sources) {
    for (const [name, field] of Object.entries(fields)) {
      output[name] = cloneField(field);
    }
  }
  return output;
}

function applyOverrides(
  fields: Record<string, FieldMeta>,
  overrides: Record<string, FieldOverride> | undefined
): Record<string, FieldMeta> {
  if (!overrides) {
    return fields;
  }
  for (const [name, override] of Object.entries(overrides)) {
    const field = fields[name];
    if (!field) {
      throw new Error(`DTO field "${name}" does not exist.`);
    }
    fields[name] = normalizeOverride(field, override);
  }
  return fields;
}

function normalizeOverride(field: FieldMeta, override: FieldOverride): FieldMeta {
  if (isSchemaNode(override)) {
    return {
      schema: override,
      optional:
        override.optional ?? field.optional ?? field.schema.optional,
      description: field.description
    };
  }
  const schema = override.schema ?? field.schema;
  const optional =
    override.optional ??
    schema.optional ??
    field.optional ??
    field.schema.optional;
  return {
    schema,
    optional,
    description: override.description ?? field.description
  };
}

function cloneField(field: FieldMeta): FieldMeta {
  return {
    schema: field.schema,
    optional: field.optional,
    description: field.description
  };
}
