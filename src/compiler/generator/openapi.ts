/**
 * OpenAPI 3.1 generator using GEMS graph-based IR.
 * Generates optimized schemas from the graph structure.
 */
import type { 
  Graph, 
  GraphNode, 
  ControllerNode, 
  OperationNode, 
  ParameterNode,
  TypeDefinitionNode,
  EdgeRelation 
} from "../graph/types.js";
import type { SchemaGraph } from "../graph/schemaGraph.js";
import { getNodesByKind, getEdgesByRelation } from "../graph/types.js";

/**
 * OpenAPI 3.1 specification
 */
export interface OpenAPI31 {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  components: {
    schemas: Record<string, JsonSchema>;
  };
  paths: Record<string, Record<string, OperationObject>>;
}

/**
 * OpenAPI operation object
 */
export interface OperationObject {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  tags?: string[];
}

/**
 * OpenAPI parameter object
 */
export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  schema: JsonSchema;
  description?: string;
}

/**
 * OpenAPI request body object
 */
export interface RequestBodyObject {
  description?: string;
  required: boolean;
  content: Record<string, MediaTypeObject>;
}

/**
 * OpenAPI response object
 */
export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

/**
 * OpenAPI media type object
 */
export interface MediaTypeObject {
  schema: JsonSchema;
  examples?: Record<string, unknown>;
}

/**
 * JSON Schema (subset for OpenAPI 3.1)
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  $ref?: string;
  description?: string;
  enum?: (string | number | boolean)[];
  nullable?: boolean;
  default?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

/**
 * OpenAPI generator options
 */
export interface OpenAPIGeneratorOptions {
  title?: string;
  version?: string;
  description?: string;
  servers?: string[];
  inlineAll?: boolean;
  excludeUnusedSchemas?: boolean;
}

/**
 * Default generator options
 */
export const DEFAULT_GENERATOR_OPTIONS: OpenAPIGeneratorOptions = {
  title: "API",
  version: "1.0.0",
  servers: [],
  inlineAll: false,
  excludeUnusedSchemas: true,
};

/**
 * Generate OpenAPI 3.1 specification from GEMS graph
 */
export function generateOpenAPIFromGraph(
  graph: Graph,
  schemaGraph: SchemaGraph,
  options: Partial<OpenAPIGeneratorOptions> = {}
): OpenAPI31 {
  const finalOptions = { ...DEFAULT_GENERATOR_OPTIONS, ...options };

  const openapi: OpenAPI31 = {
    openapi: "3.1.0",
    info: {
      title: finalOptions.title || "API",
      version: finalOptions.version || "1.0.0",
      description: finalOptions.description,
    },
    servers: finalOptions.servers?.map(url => ({ url })),
    components: {
      schemas: {},
    },
    paths: {},
  };

  // Generate schemas from graph
  generateSchemas(graph, schemaGraph, openapi.components.schemas, finalOptions);

  // Generate paths from controllers
  const controllers = getNodesByKind<ControllerNode>(graph, 'Controller');
  for (const controller of controllers) {
    generateControllerPaths(
      graph,
      controller,
      openapi.paths,
      openapi.components.schemas,
      finalOptions
    );
  }

  // Exclude unused schemas if configured
  if (finalOptions.excludeUnusedSchemas) {
    removeUnusedSchemas(openapi, graph);
  }

  return openapi;
}

/**
 * Generate schema components from graph
 */
function generateSchemas(
  graph: Graph,
  schemaGraph: SchemaGraph,
  schemas: Record<string, JsonSchema>,
  options: OpenAPIGeneratorOptions
): void {
  const typeNodes = getNodesByKind<TypeDefinitionNode>(graph, 'TypeDefinition');

  for (const typeNode of typeNodes) {
    const schema = generateSchemaFromTypeNode(graph, typeNode, options);
    
    // Use type name as schema key (strip generic parameters)
    const schemaKey = typeNode.metadata.name
      .replace(/<.*>/g, '')
      .replace(/\s+/g, '');
    
    schemas[schemaKey] = schema;
  }
}

/**
 * Generate JSON Schema from type definition node
 */
function generateSchemaFromTypeNode(
  graph: Graph,
  typeNode: TypeDefinitionNode,
  options: OpenAPIGeneratorOptions
): JsonSchema {
  const schema: JsonSchema = {
    type: "object",
    description: typeNode.metadata.annotations?.get('description') as string,
  };

  if (typeNode.typeDef.properties && typeNode.typeDef.properties.size > 0) {
    schema.properties = {};
    schema.required = [];

    for (const [propName, propTypeId] of typeNode.typeDef.properties) {
      const propNode = graph.nodes.get(propTypeId);
      if (!propNode) continue;

      const propSchema = generatePropertySchema(graph, propNode, options);
      schema.properties[propName] = propSchema;

      // Check if property is required
      const isRequired = checkPropertyRequired(graph, propNode, propTypeId);
      if (isRequired) {
        schema.required.push(propName);
      }
    }
  }

  // Add tags as vendor extensions
  if (typeNode.metadata.tags && typeNode.metadata.tags.size > 0) {
    (schema as any)["x-tags"] = Array.from(typeNode.metadata.tags);
  }

  return schema;
}

/**
 * Generate schema for a property
 */
function generatePropertySchema(
  graph: Graph,
  node: GraphNode,
  options: OpenAPIGeneratorOptions
): JsonSchema {
  const kind = node.kind;

  switch (kind) {
    case 'TypeDefinition':
      if (options.inlineAll) {
        return generateSchemaFromTypeNode(graph, node as TypeDefinitionNode, options);
      }
      return { $ref: `#/components/schemas/${node.metadata.name}` };

    case 'SchemaComponent':
      return generateSchemaFromComponentNode(node);

    case 'Enum':
      return generateSchemaFromEnumNode(node);

    case 'Union':
      return generateSchemaFromUnionNode(graph, node);

    case 'Intersection':
      return generateSchemaFromIntersectionNode(graph, node);

    default:
      return { type: "unknown" };
  }
}

/**
 * Check if a property is required
 */
function checkPropertyRequired(
  graph: Graph,
  propNode: GraphNode,
  propTypeId: string
): boolean {
  const usesEdges = getEdgesByRelation(graph, 'uses');
  
  for (const { sourceId } of usesEdges) {
    if (sourceId === propTypeId) {
      const sourceNode = graph.nodes.get(sourceId);
      if (sourceNode?.kind === 'Parameter') {
        return !(sourceNode as ParameterNode).parameter.isOptional;
      }
    }
  }

  return false;
}

/**
 * Generate schema from schema component node
 */
function generateSchemaFromComponentNode(node: GraphNode): JsonSchema {
  return (node as any).schema?.definition || { type: "unknown" };
}

/**
 * Generate schema from enum node
 */
function generateSchemaFromEnumNode(node: GraphNode): JsonSchema {
  return {
    type: "string",
    enum: (node as any).enumDef?.values || [],
  };
}

/**
 * Generate schema from union node
 */
function generateSchemaFromUnionNode(graph: Graph, node: GraphNode): JsonSchema {
  const unionNode = node as any;
  if (unionNode.union?.types) {
    return {
      anyOf: unionNode.union.types.map((typeId: string) => {
        const typeNode = graph.nodes.get(typeId);
        if (!typeNode) return { type: "unknown" };
        return generatePropertySchema(graph, typeNode, { inlineAll: false });
      }),
    };
  }
  return { type: "unknown" };
}

/**
 * Generate schema from intersection node
 */
function generateSchemaFromIntersectionNode(graph: Graph, node: GraphNode): JsonSchema {
  const intersectionNode = node as any;
  if (intersectionNode.intersection?.types) {
    return {
      allOf: intersectionNode.intersection.types.map((typeId: string) => {
        const typeNode = graph.nodes.get(typeId);
        if (!typeNode) return { type: "unknown" };
        return generatePropertySchema(graph, typeNode, { inlineAll: false });
      }),
    };
  }
  return { type: "unknown" };
}

/**
 * Generate OpenAPI paths for a controller
 */
function generateControllerPaths(
  graph: Graph,
  controller: ControllerNode,
  paths: Record<string, Record<string, OperationObject>>,
  schemas: Record<string, JsonSchema>,
  options: OpenAPIGeneratorOptions
): void {
  const operations = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === controller.id);

  for (const { edge: containsEdge } of operations) {
    const operationNode = graph.nodes.get(containsEdge.targetId);
    if (!operationNode || operationNode.kind !== 'Operation') continue;

    const opNode = operationNode as OperationNode;
    const path = buildPath(controller, opNode);
    const method = opNode.operation.httpMethod.toLowerCase();

    if (!paths[path]) {
      paths[path] = {};
    }

    paths[path][method] = generateOperationObject(
      graph,
      controller,
      opNode,
      schemas,
      options
    );
  }
}

/**
 * Build full path from controller and operation
 */
function buildPath(controller: ControllerNode, operation: OperationNode): string {
  const basePath = controller.controller.basePath || '/';
  const operationPath = operation.operation.path || '/';
  
  // Remove trailing slash from base
  const cleanBase = basePath.endsWith('/') 
    ? basePath.slice(0, -1) 
    : basePath;
  
  // Remove leading slash from operation path
  const cleanOp = operationPath.startsWith('/') 
    ? operationPath.slice(1) 
    : operationPath;
  
  const fullPath = `${cleanBase}/${cleanOp}`;
  
  // Convert :params to {params}
  return fullPath.replace(/:([^/]+)/g, '{$1}');
}

/**
 * Generate OpenAPI operation object
 */
function generateOperationObject(
  graph: Graph,
  controller: ControllerNode,
  operation: OperationNode,
  schemas: Record<string, JsonSchema>,
  options: OpenAPIGeneratorOptions
): OperationObject {
  const operationObj: OperationObject = {
    operationId: operation.operation.operationId,
    responses: {},
    tags: [controller.metadata.name],
  };

  // Generate parameters
  const parameters = generateParameters(graph, operation);
  if (parameters.length > 0) {
    operationObj.parameters = parameters;
  }

  // Generate request body
  const requestBody = generateRequestBody(graph, operation, controller, options);
  if (requestBody) {
    operationObj.requestBody = requestBody;
  }

  // Generate response
  operationObj.responses = generateResponses(graph, operation, schemas, options);

  return operationObj;
}

/**
 * Generate parameters for an operation
 */
function generateParameters(
  graph: Graph,
  operation: OperationNode
): ParameterObject[] {
  const parameters: ParameterObject[] = [];
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    
    // Skip body parameters - they're handled in request body
    if (p.parameter.location === 'body') continue;
    
    parameters.push({
      name: p.metadata.name,
      in: p.parameter.location,
      required: !p.parameter.isOptional,
      schema: generateParameterSchema(graph, p),
    });
  }

  return parameters;
}

/**
 * Generate schema for a parameter
 */
function generateParameterSchema(graph: Graph, paramNode: ParameterNode): JsonSchema {
  const typeNode = graph.nodes.get(paramNode.parameter.type);
  if (!typeNode) return { type: "string" };

  return generatePropertySchema(graph, typeNode, { inlineAll: false });
}

/**
 * Generate request body for an operation
 */
function generateRequestBody(
  graph: Graph,
  operation: OperationNode,
  controller: ControllerNode,
  options: OpenAPIGeneratorOptions
): RequestBodyObject | undefined {
  // Check if operation has a body parameter
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    if (p.parameter.location === 'body') {
      const contentType = controller.controller.consumes?.[0] || "application/json";
      
      return {
        required: !p.parameter.isOptional,
        content: {
          [contentType]: {
            schema: generateParameterSchema(graph, p),
          },
        },
      };
    }
  }

  return undefined;
}

/**
 * Generate responses for an operation
 */
function generateResponses(
  graph: Graph,
  operation: OperationNode,
  schemas: Record<string, JsonSchema>,
  options: OpenAPIGeneratorOptions
): Record<string, ResponseObject> {
  const responses: Record<string, ResponseObject> = {};

  const returnTypeNode = graph.nodes.get(operation.operation.returnType);
  if (!returnTypeNode) {
    return responses;
  }

  const schema = generatePropertySchema(graph, returnTypeNode, options);
  const statusCode = operation.operation.httpMethod === 'POST' ? '201' : '200';

  responses[statusCode] = {
    description: statusCode === '201' ? 'Created' : 'OK',
    content: {
      "application/json": {
        schema,
      },
    },
  };

  return responses;
}

/**
 * Remove unused schemas from OpenAPI spec
 */
function removeUnusedSchemas(openapi: OpenAPI31, graph: Graph): void {
  const usedSchemas = new Set<string>();

  // Find all $ref usages
  const findRefs = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        if ('$ref' in value && typeof value.$ref === 'string') {
          const ref = value.$ref as string;
          if (ref.startsWith('#/components/schemas/')) {
            const schemaName = ref.replace('#/components/schemas/', '');
            usedSchemas.add(schemaName);
          }
        }
        findRefs(value);
      }
    }
  };

  // Check paths
  findRefs(openapi.paths);

  // Check existing schemas for nested refs
  findRefs(openapi.components.schemas);

  // Remove unused schemas
  for (const schemaName of Object.keys(openapi.components.schemas)) {
    if (!usedSchemas.has(schemaName)) {
      delete openapi.components.schemas[schemaName];
    }
  }
}

/**
 * Generate OpenAPI spec from GEMS compilation result
 */
export function generateOpenAPI(
  graph: Graph,
  schemaGraph: SchemaGraph,
  options?: Partial<OpenAPIGeneratorOptions>
): OpenAPI31 {
  return generateOpenAPIFromGraph(graph, schemaGraph, options);
}
