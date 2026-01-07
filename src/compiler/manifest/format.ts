/**
 * Manifest type definitions.
 * Describes the structure of the manifest file generated during compilation.
 */

/**
 * Supported HTTP methods for API operations.
 */
export type HttpMethod =
  | "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  | "OPTIONS" | "HEAD";

/**
 * Supported content types for request and response bodies.
 */
export type ContentType =
  | "application/json"
  | "text/plain"
  | "application/octet-stream"
  | "multipart/form-data"
  | string;

/**
 * Root manifest interface representing the complete API metadata.
 * Contains version, generation info, schema references, and all controller definitions.
 */
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

/**
 * Represents a controller entry in the manifest.
 * Contains the controller identifier and all its operations.
 */
export interface ControllerEntry {
  controllerId: string;
  basePath: string;
  operations: OperationEntry[];
}

/**
 * Represents a single API operation (endpoint) in the manifest.
 * Contains operation ID, HTTP method/path, handler reference, arguments, and responses.
 */
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

/**
 * Specification of all arguments for an operation.
 * Groups arguments by their location (body, path, query, headers, cookies).
 */
export interface ArgsSpec {
  body: BodyArgSpec | null;
  path: NamedArgSpec[];
  query: NamedArgSpec[];
  headers: NamedArgSpec[];
  cookies: NamedArgSpec[];
}

/**
 * Specification for a request body argument.
 */
export interface BodyArgSpec {
  index: number;
  required: boolean;
  contentType: ContentType;
  schemaRef: string;
  encoding?: Record<string, EncodingSpec>;
}

/**
 * Encoding options for multipart request bodies.
 */
export interface EncodingSpec {
  contentType?: string;
  headers?: Record<string, string>;
}

/**
 * Specification for named arguments (path, query, headers, cookies).
 * Contains the parameter name, index, requirement status, and schema reference.
 */
export interface NamedArgSpec {
  name: string;
  index: number;
  required: boolean;
  schemaRef: string;
  schemaType?: string | string[];
  serialization?: SerializationSpec;
  content?: "application/json";
}

/**
 * Serialization options for complex parameter types.
 */
export interface SerializationSpec {
  style?: "form" | "spaceDelimited" | "pipeDelimited" | "deepObject";
  explode?: boolean;
  allowReserved?: boolean;
}

/**
 * Specification for an operation response.
 */
export interface ResponseSpec {
  status: number;
  contentType: ContentType;
  schemaRef: string;
  isArray?: boolean;
}
