import type { SchemaNode, SchemaSource } from "./schema";
import type { Constructor, DtoConstructor, HttpMethod } from "./types";
import {
  getAdornMetadata,
  registerController,
  registerDto,
  type ControllerMeta,
  type DecoratorMetadata,
  type DtoMeta,
  type FieldMeta,
  type InputMeta,
  type ResponseMeta,
  type RouteMetaInput
} from "./metadata";

export interface DtoOptions {
  name?: string;
  description?: string;
  additionalProperties?: boolean;
}

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

function finalizeRoute(route: RouteMetaInput): RouteMetaInput {
  if (!route.httpMethod) {
    throw new Error(`Missing HTTP method decorator on route "${String(route.handlerName)}".`);
  }
  if (route.path === undefined) {
    throw new Error(`Missing path for route "${String(route.handlerName)}".`);
  }
  if (!route.responses.length) {
    route.responses.push({ status: 200, description: "OK" });
  }
  return route;
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
