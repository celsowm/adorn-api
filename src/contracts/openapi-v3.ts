/**
 * Complete OpenAPI 3.0.3 document structure.
 *
 * This type represents the root OpenAPI document that contains
 * all API metadata, paths, operations, and components.
 *
 * @see https://spec.openapis.org/oas/v3.0.3
 *
 * @example
 * ```typescript
 * const openApiDoc: OpenApiDocument = {
 *   openapi: '3.0.3',
 *   info: {
 *     title: 'My API',
 *     version: '1.0.0',
 *     description: 'API for user management'
 *   },
 *   servers: [
 *     { url: 'https://api.example.com/v1', description: 'Production server' }
 *   ],
 *   paths: {
 *     '/users': {
 *       get: {
 *         summary: 'List users',
 *         responses: {
 *           '200': { description: 'List of users' }
 *         }
 *       }
 *     }
 *   },
 *   components: {
 *     schemas: {
 *       User: {
 *         type: 'object',
 *         properties: {
 *           id: { type: 'string', format: 'uuid' },
 *           name: { type: 'string' }
 *         }
 *       }
 *     }
 *   }
 * };
 * ```
 */
export type OpenApiDocument = {
  /** OpenAPI specification version */
  openapi: '3.0.3' | (string & {});
  /** API metadata including title, version, and description */
  info: { title: string; version: string; description?: string };
  /** Array of server objects */
  servers?: Array<{ url: string; description?: string }>;
  /** Paths and operations */
  paths: Record<string, PathItemObject>;
  /** Reusable components */
  components?: ComponentsObject;
};

/**
 * Reusable components for OpenAPI specification.
 *
 * Contains schemas, security schemes, and other reusable
 * components that can be referenced throughout the document.
 *
 * @example
 * ```typescript
 * const components: ComponentsObject = {
 *   schemas: {
 *     User: {
 *       type: 'object',
 *       properties: {
 *         id: { type: 'string', format: 'uuid' },
 *         name: { type: 'string' }
 *       }
 *     }
 *   },
 *   securitySchemes: {
 *     bearerAuth: {
 *       type: 'http',
 *       scheme: 'bearer',
 *       bearerFormat: 'JWT'
 *     }
 *   }
 * };
 * ```
 */
export type ComponentsObject = {
  /** Reusable schema definitions */
  schemas?: Record<string, SchemaObject>;
  /** Security scheme definitions */
  securitySchemes?: Record<string, SecuritySchemeObject>;
};

/**
 * Path item containing HTTP method operations.
 *
 * Maps HTTP methods to their corresponding operation objects
 * for a specific path.
 *
 * @example
 * ```typescript
 * const pathItem: PathItemObject = {
 *   get: {
 *     summary: 'Get user',
 *     responses: { '200': { description: 'User found' } }
 *   },
 *   post: {
 *     summary: 'Create user',
 *     responses: { '201': { description: 'User created' } }
 *   }
 * };
 * ```
 */
export type PathItemObject = Partial<Record<HttpMethod, OperationObject>>;

/**
 * HTTP methods supported by OpenAPI.
 *
 * Standard HTTP methods that can be used in path items.
 */
export type HttpMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head';

/**
 * Operation object describing an API endpoint.
 *
 * Contains all information about a single API operation
 * including parameters, request body, responses, and security.
 *
 * @example
 * ```typescript
 * const operation: OperationObject = {
 *   operationId: 'getUserById',
 *   summary: 'Get user by ID',
 *   description: 'Retrieves a user by their unique identifier',
 *   tags: ['Users'],
 *   deprecated: false,
 *   security: [{ bearerAuth: [] }],
 *   parameters: [
 *     {
 *       name: 'id',
 *       in: 'path',
 *       required: true,
 *       schema: { type: 'string', format: 'uuid' }
 *     }
 *   ],
 *   responses: {
 *     '200': {
 *       description: 'User found',
 *       content: {
 *         'application/json': {
 *           schema: { $ref: '#/components/schemas/User' }
 *         }
 *       }
 *     },
 *     '404': { description: 'User not found' }
 *   }
 * };
 * ```
 */
export type OperationObject = {
  /** Unique identifier for the operation */
  operationId?: string;
  /** Short summary of the operation */
  summary?: string;
  /** Detailed description of the operation */
  description?: string;
  /** Tags for grouping operations */
  tags?: string[];
  /** Whether the operation is deprecated */
  deprecated?: boolean;
  /** Security requirements */
  security?: SecurityRequirementObject[];
  /** Parameters for the operation */
  parameters?: ParameterObject[];
  /** Request body specification */
  requestBody?: RequestBodyObject;
  /** Responses by status code */
  responses: Record<string, ResponseObject>;
};

/**
 * Parameter object for operation parameters.
 *
 * Describes a single parameter that can be passed
 * in path, query, header, or cookie.
 *
 * @example
 * ```typescript
 * // Path parameter
 * const pathParam: ParameterObject = {
 *   name: 'id',
 *   in: 'path',
 *   required: true,
 *   schema: { type: 'string', format: 'uuid' }
 * };
 *
 * // Query parameter
 * const queryParam: ParameterObject = {
 *   name: 'limit',
 *   in: 'query',
 *   required: false,
 *   schema: { type: 'integer', minimum: 1, maximum: 100 }
 * };
 *
 * // Header parameter
 * const headerParam: ParameterObject = {
 *   name: 'X-Request-ID',
 *   in: 'header',
 *   required: false,
 *   schema: { type: 'string' }
 * };
 * ```
 */
export type ParameterObject = {
  /** Parameter name */
  name: string;
  /** Parameter location */
  in: 'path' | 'query' | 'header' | 'cookie';
  /** Whether parameter is required */
  required?: boolean;
  /** Parameter schema or reference */
  schema?: SchemaObject | ReferenceObject;
};

/**
 * Request body object for operation input.
 *
 * Describes the request body including content types
 * and schemas for different media types.
 *
 * @example
 * ```typescript
 * const requestBody: RequestBodyObject = {
 *   required: true,
 *   content: {
 *     'application/json': {
 *       schema: {
 *         type: 'object',
 *         properties: {
 *           name: { type: 'string' },
 *           email: { type: 'string', format: 'email' }
 *         },
 *         required: ['name', 'email']
 *       }
 *     },
 *     'application/xml': {
 *       schema: { type: 'string' }
 *     }
 *   }
 * };
 * ```
 */
export type RequestBodyObject = {
  /** Whether request body is required */
  required?: boolean;
  /** Content by media type */
  content: Record<string, MediaTypeObject>;
};

/**
 * Response object for operation outputs.
 *
 * Describes a single response including status code,
 * headers, and content for different media types.
 *
 * @example
 * ```typescript
 * const response: ResponseObject = {
 *   description: 'User created successfully',
 *   headers: {
 *     'Location': {
 *       description: 'URL of the created user',
 *       schema: { type: 'string', format: 'uri' }
 *     }
 *   },
 *   content: {
 *     'application/json': {
 *       schema: { $ref: '#/components/schemas/User' },
 *       example: {
 *         id: '550e8400-e29b-41d4-a716-446655440000',
 *         name: 'John Doe',
 *         email: 'john@example.com'
 *       }
 *     }
 *   }
 * };
 * ```
 */
export type ResponseObject = {
  /** Response description */
  description: string;
  /** Response headers */
  headers?: Record<string, HeaderObject>;
  /** Response content by media type */
  content?: Record<string, MediaTypeObject>;
};

/**
 * Header object for response headers.
 *
 * Describes a single response header including
 * its schema and whether it's required.
 *
 * @example
 * ```typescript
 * const header: HeaderObject = {
 *   required: true,
 *   description: 'Unique request identifier',
 *   schema: { type: 'string', format: 'uuid' }
 * };
 * ```
 */
export type HeaderObject = {
  /** Whether header is required */
  required?: boolean;
  /** Header description */
  description?: string;
  /** Header schema or reference */
  schema?: SchemaObject | ReferenceObject;
};

/**
 * Media type object for request/response content.
 *
 * Describes the structure and examples for
 * a specific media type.
 *
 * @example
 * ```typescript
 * const mediaType: MediaTypeObject = {
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       id: { type: 'string', format: 'uuid' },
 *       name: { type: 'string' }
 *     }
 *   },
 *   example: {
 *     id: '550e8400-e29b-41d4-a716-446655440000',
 *     name: 'John Doe'
 *   }
 * };
 * ```
 */
export type MediaTypeObject = {
  /** Media type schema or reference */
  schema?: SchemaObject | ReferenceObject;
  /** Example value */
  example?: unknown;
};

/**
 * Reference object for reusable components.
 *
 * Allows referencing other parts of the OpenAPI
 * document using JSON references.
 *
 * @example
 * ```typescript
 * // Reference to a schema component
 * const schemaRef: ReferenceObject = {
 *   $ref: '#/components/schemas/User'
 * };
 *
 * // Reference to a security scheme
 * const securityRef: ReferenceObject = {
 *   $ref: '#/components/securitySchemes/bearerAuth'
 * };
 * ```
 */
export type ReferenceObject = {
  /** JSON reference to another component */
  $ref: string;
};

/**
 * Security requirement object.
 *
 * Specifies which security schemes are required
 * for an operation.
 *
 * @example
 * ```typescript
 * // Bearer token security requirement
 * const securityReq: SecurityRequirementObject = {
 *   bearerAuth: []
 * };
 *
 * // Multiple security schemes (OR relationship)
 * const multiSecurityReq: SecurityRequirementObject = {
 *   bearerAuth: [],
 *   apiKey: []
 * };
 *
 * // Security scheme with scopes (OAuth2)
 * const oauthSecurityReq: SecurityRequirementObject = {
 *   oauth2: ['read', 'write']
 * };
 * ```
 */
export type SecurityRequirementObject = Record<string, string[]>;

/**
 * Security scheme object.
 *
 * Defines authentication/authorization schemes
 * that can be used by operations.
 *
 * @example
 * ```typescript
 * // Bearer token security scheme
 * const bearerScheme: SecuritySchemeObject = {
 *   type: 'http',
 *   scheme: 'bearer',
 *   bearerFormat: 'JWT',
 *   description: 'Bearer token authentication'
 * };
 *
 * // API key security scheme
 * const apiKeyScheme: SecuritySchemeObject = {
 *   type: 'apiKey',
 *   name: 'X-API-Key',
 *   in: 'header',
 *   description: 'API key authentication'
 * };
 *
 * // OAuth2 security scheme
 * const oauthScheme: SecuritySchemeObject = {
 *   type: 'oauth2',
 *   flows: {
 *     authorizationCode: {
 *       authorizationUrl: 'https://auth.example.com/authorize',
 *       tokenUrl: 'https://auth.example.com/token',
 *       scopes: {
 *         read: 'Read access',
 *         write: 'Write access'
 *       }
 *     }
 *   }
 * };
 * ```
 */
export type SecuritySchemeObject = {
  /** Type of security scheme */
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  /** Description of the security scheme */
  description?: string;
  /** Name of the header, query, or cookie parameter */
  name?: string;
  /** Location of the API key */
  in?: 'query' | 'header' | 'cookie';
  /** HTTP scheme (for type: http) */
  scheme?: string;
  /** Bearer format (for type: http with bearer scheme) */
  bearerFormat?: string;
  /** OAuth2 flows */
  flows?: Record<string, unknown>;
  /** OpenID Connect URL */
  openIdConnectUrl?: string;
};

/**
 * Schema object for data structure definition.
 *
 * Defines the structure, validation, and constraints
 * for data used in parameters, request bodies, and responses.
 *
 * @example
 * ```typescript
 * // Simple object schema
 * const userSchema: SchemaObject = {
 *   type: 'object',
 *   properties: {
 *     id: { type: 'string', format: 'uuid' },
 *     name: { type: 'string', minLength: 3 },
 *     email: { type: 'string', format: 'email' },
 *     age: { type: 'integer', minimum: 18 }
 *   },
 *   required: ['name', 'email']
 * };
 *
 * // Array schema
 * const usersArraySchema: SchemaObject = {
 *   type: 'array',
 *   items: { $ref: '#/components/schemas/User' },
 *   minItems: 1,
 *   maxItems: 100
 * };
 *
 * // String with validation
 * const usernameSchema: SchemaObject = {
 *   type: 'string',
 *   minLength: 3,
 *   maxLength: 32,
 *   pattern: '^[a-zA-Z0-9_]+$'
 * };
 *
 * // Union schema
 * const resultSchema: SchemaObject = {
 *   anyOf: [
 *     { $ref: '#/components/schemas/User' },
 *     { $ref: '#/components/schemas/Error' }
 *   ]
 * };
 * ```
 */
export type SchemaObject = {
  /** Data type */
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  /** Format for primitive types */
  format?: string;
  /** Whether value can be null */
  nullable?: boolean;

  // validation-ish
  /** Minimum length for strings */
  minLength?: number;
  /** Maximum length for strings */
  maxLength?: number;
  /** Regular expression pattern for strings */
  pattern?: string;
  /** Minimum value for numbers */
  minimum?: number;
  /** Maximum value for numbers */
  maximum?: number;
  /** Minimum number of items for arrays */
  minItems?: number;
  /** Maximum number of items for arrays */
  maxItems?: number;

  // structure
  /** Object properties */
  properties?: Record<string, SchemaObject | ReferenceObject>;
  /** Required properties */
  required?: string[];
  /** Additional properties policy */
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  /** Array items schema */
  items?: SchemaObject | ReferenceObject;
  /** Enum values */
  enum?: Array<string | number | boolean | null>;

  // unions
  /** Any of the schemas (logical OR) */
  anyOf?: Array<SchemaObject | ReferenceObject>;
  /** One of the schemas (exclusive OR) */
  oneOf?: Array<SchemaObject | ReferenceObject>;
  /** All of the schemas (logical AND) */
  allOf?: Array<SchemaObject | ReferenceObject>;
};
