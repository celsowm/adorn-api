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

export interface DtoOptions {
  name?: string;
  description?: string;
  additionalProperties?: boolean;
}

export interface DtoComposeOptions extends DtoOptions {
  overrides?: Record<string, FieldOverride>;
}

export interface FieldOverrideOptions {
  schema?: SchemaNode;
  optional?: boolean;
  description?: string;
}

export type FieldOverride = SchemaNode | FieldOverrideOptions;

export interface FieldOptions {
  schema: SchemaNode;
  optional?: boolean;
  description?: string;
}

export interface ControllerOptions {
  path?: string;
  tags?: string[];
}

export interface DocOptions {
  summary?: string;
  description?: string;
  tags?: string[];
}

export interface InputOptions {
  description?: string;
  required?: boolean;
  contentType?: string;
}

export interface ReturnsOptions {
  status?: number;
  schema?: SchemaSource;
  description?: string;
  contentType?: string;
}

export interface ErrorResponseOptions
  extends Omit<ReturnsOptions, "schema" | "status"> {
  status: number;
}

export function Dto(options: DtoOptions = {}) {
  return (value: Function, context: ClassDecoratorContext): void => {
    const meta = getAdornMetadata(context.metadata as DecoratorMetadata);
    const fields = meta.dtoFields ?? {};
    const dtoMeta: DtoMeta = {
      name: options.name ?? value.name,
      description: options.description,
      fields,
      additionalProperties: options.additionalProperties
    };
    registerDto(value as DtoConstructor, dtoMeta);
  };
}

export function PickDto(
  dto: DtoConstructor,
  keys: string[],
  options: DtoComposeOptions = {}
) {
  return (value: Function, _context: ClassDecoratorContext): void => {
    const dtoMeta = getDtoMetaOrThrow(dto);
    const fields = pickFields(dtoMeta.fields, keys);
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value as DtoConstructor, buildDerivedMeta(value, dtoMeta, mergedFields, options));
  };
}

export function OmitDto(
  dto: DtoConstructor,
  keys: string[],
  options: DtoComposeOptions = {}
) {
  return (value: Function, _context: ClassDecoratorContext): void => {
    const dtoMeta = getDtoMetaOrThrow(dto);
    const fields = omitFields(dtoMeta.fields, keys);
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value as DtoConstructor, buildDerivedMeta(value, dtoMeta, mergedFields, options));
  };
}

export function PartialDto(dto: DtoConstructor, options: DtoComposeOptions = {}) {
  return (value: Function, _context: ClassDecoratorContext): void => {
    const dtoMeta = getDtoMetaOrThrow(dto);
    const fields = makeFieldsPartial(dtoMeta.fields);
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value as DtoConstructor, buildDerivedMeta(value, dtoMeta, mergedFields, options));
  };
}

export function MergeDto(dtos: DtoConstructor[], options: DtoComposeOptions = {}) {
  return (value: Function, _context: ClassDecoratorContext): void => {
    if (!dtos.length) {
      throw new Error("MergeDto requires at least one DTO.");
    }
    const metas = dtos.map(getDtoMetaOrThrow);
    const fields = mergeFields(metas.map((meta) => meta.fields));
    const mergedFields = applyOverrides(fields, options.overrides);
    registerDto(value as DtoConstructor, buildDerivedMeta(value, metas[0], mergedFields, options));
  };
}

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

export function Controller(pathOrOptions: string | ControllerOptions = {}) {
  return (value: Function, context: ClassDecoratorContext): void => {
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

export function Doc(options: DocOptions) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.summary = options.summary;
    route.description = options.description;
    route.tags = options.tags;
  };
}

export function Get(path = "") {
  return Route("get", path);
}

export function Post(path = "") {
  return Route("post", path);
}

export function Put(path = "") {
  return Route("put", path);
}

export function Patch(path = "") {
  return Route("patch", path);
}

export function Delete(path = "") {
  return Route("delete", path);
}

export function Body(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.body = buildInputMeta(schema, options);
  };
}

export function Query(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.query = buildInputMeta(schema, options);
  };
}

export function Params(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.params = buildInputMeta(schema, options);
  };
}

export function Headers(schema: SchemaSource, options: InputOptions = {}) {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const route = getRoute(context.metadata as DecoratorMetadata, context.name);
    route.headers = buildInputMeta(schema, options);
  };
}

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
  value: Function,
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
