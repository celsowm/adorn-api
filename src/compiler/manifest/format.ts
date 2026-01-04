export type HttpMethod =
  | "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  | "OPTIONS" | "HEAD";

export type ContentType =
  | "application/json"
  | "text/plain"
  | "application/octet-stream"
  | "multipart/form-data"
  | string;

export interface ManifestV1 {
  manifestVersion: 1;
  generatedAt: string;
  generator: {
    name: "adorn-api";
    version: string;
    typescript: string;
  };

  schemas: {
    kind: "openapi-3.1";
    file: string;
    componentsSchemasPointer: string;
  };

  validation: {
    mode: "none" | "ajv-runtime" | "precompiled";
    precompiledModule: string | null;
  };

  controllers: ControllerEntry[];
}

export interface ControllerEntry {
  controllerId: string;
  basePath: string;
  operations: OperationEntry[];
}

export interface OperationEntry {
  operationId: string;
  http: {
    method: HttpMethod;
    path: string;
  };
  handler: {
    methodName: string;
  };
  args: ArgsSpec;
  responses: ResponseSpec[];
}

export interface ArgsSpec {
  body: BodyArgSpec | null;
  path: NamedArgSpec[];
  query: NamedArgSpec[];
  headers: NamedArgSpec[];
  cookies: NamedArgSpec[];
  paginationParamIndex: number | null;
}

export interface BodyArgSpec {
  index: number;
  required: boolean;
  contentType: ContentType;
  schemaRef: string;
  encoding?: Record<string, EncodingSpec>;
}

export interface EncodingSpec {
  contentType?: string;
  headers?: Record<string, string>;
}

export interface NamedArgSpec {
  name: string;
  index: number;
  required: boolean;
  schemaRef: string;
  schemaType?: string | string[];
  serialization?: SerializationSpec;
  content?: "application/json";
}

export interface SerializationSpec {
  style?: "form" | "spaceDelimited" | "pipeDelimited" | "deepObject";
  explode?: boolean;
  allowReserved?: boolean;
}

export interface ResponseSpec {
  status: number;
  contentType: ContentType;
  schemaRef: string;
  isArray?: boolean;
}
