export type OpenApiDocument = {
  openapi: '3.0.3' | (string & {});
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItemObject>;
  components?: ComponentsObject;
};

export type ComponentsObject = {
  schemas?: Record<string, SchemaObject>;
};

export type PathItemObject = Partial<Record<HttpMethod, OperationObject>>;

export type HttpMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head';

export type OperationObject = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
};

export type ParameterObject = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: SchemaObject | ReferenceObject;
};

export type RequestBodyObject = {
  required?: boolean;
  content: Record<string, MediaTypeObject>;
};

export type ResponseObject = {
  description: string;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
};

export type HeaderObject = {
  required?: boolean;
  description?: string;
  schema?: SchemaObject | ReferenceObject;
};

export type MediaTypeObject = {
  schema?: SchemaObject | ReferenceObject;
  example?: unknown;
};

export type ReferenceObject = {
  $ref: string;
};

export type SchemaObject = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  nullable?: boolean;

  // validation-ish
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;

  // structure
  properties?: Record<string, SchemaObject | ReferenceObject>;
  required?: string[];
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  items?: SchemaObject | ReferenceObject;
  enum?: Array<string | number | boolean | null>;

  // unions
  anyOf?: Array<SchemaObject | ReferenceObject>;
  oneOf?: Array<SchemaObject | ReferenceObject>;
  allOf?: Array<SchemaObject | ReferenceObject>;
};
