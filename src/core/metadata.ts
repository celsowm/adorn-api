import type { SchemaNode, SchemaSource } from "./schema";
import type { Constructor, DtoConstructor, HttpMethod } from "./types";

// Ensure standard decorator metadata is available for Stage 3 decorators.
const symbolMetadata = (Symbol as { metadata?: symbol }).metadata;
if (!symbolMetadata) {
  (Symbol as { metadata?: symbol }).metadata = Symbol("Symbol.metadata");
}

export interface FieldMeta {
  schema: SchemaNode;
  optional?: boolean;
  description?: string;
}

export interface DtoMeta {
  name: string;
  description?: string;
  fields: Record<string, FieldMeta>;
  additionalProperties?: boolean;
}

export interface InputMeta {
  schema: SchemaSource;
  description?: string;
  required?: boolean;
  contentType?: string;
}

export interface UploadedFileMeta {
  fieldName: string;
  schema: SchemaSource;
  description?: string;
  required?: boolean;
  multiple?: boolean;
}

export interface ResponseMeta {
  status: number;
  schema?: SchemaSource;
  description?: string;
  contentType?: string;
  error?: boolean;
}

export interface RouteMeta {
  httpMethod: HttpMethod;
  path: string;
  handlerName: string | symbol;
  summary?: string;
  description?: string;
  tags?: string[];
  body?: InputMeta;
  query?: InputMeta;
  params?: InputMeta;
  headers?: InputMeta;
  files?: UploadedFileMeta[];
  responses: ResponseMeta[];
  /** Whether this route uses Server-Sent Events */
  sse?: boolean;
  /** Whether this route uses streaming response */
  streaming?: boolean;
}

export interface ControllerMeta {
  basePath: string;
  controller: Constructor;
  routes: RouteMeta[];
  tags?: string[];
}

const dtoStore = new Map<DtoConstructor, DtoMeta>();
const controllerStore = new Map<Constructor, ControllerMeta>();

export const META_KEY: unique symbol = Symbol.for("adorn.metadata");

export interface DecoratorMetadata {
  [META_KEY]?: AdornMetadata;
}

export interface AdornMetadata {
  dtoFields?: Record<string, FieldMeta>;
  dtoOptions?: {
    name?: string;
    description?: string;
    additionalProperties?: boolean;
  };
  routes?: RouteMetaInput[];
  controllerOptions?: {
    path?: string;
    tags?: string[];
  };
}

export interface RouteMetaInput extends Partial<RouteMeta> {
  handlerName: string | symbol;
  responses: ResponseMeta[];
}

export function getAdornMetadata(metadata: DecoratorMetadata): AdornMetadata {
  // Handle case where metadata is undefined (when Symbol.metadata is not available)
  if (!metadata) {
    const temp: any = {};
    temp[META_KEY] = {};
    return temp[META_KEY];
  }
  
  if (!metadata[META_KEY]) {
    metadata[META_KEY] = {};
  }
  return metadata[META_KEY]!;
}

export function registerDto(dto: DtoConstructor, meta: DtoMeta): void {
  dtoStore.set(dto, meta);
}

export function getDtoMeta(dto: DtoConstructor): DtoMeta | undefined {
  return dtoStore.get(dto);
}

export function getAllDtos(): Array<[DtoConstructor, DtoMeta]> {
  return Array.from(dtoStore.entries());
}

export function registerController(meta: ControllerMeta): void {
  controllerStore.set(meta.controller, meta);
}

export function getControllerMeta(controller: Constructor): ControllerMeta | undefined {
  return controllerStore.get(controller);
}

export function getAllControllers(): Array<[Constructor, ControllerMeta]> {
  return Array.from(controllerStore.entries());
}
