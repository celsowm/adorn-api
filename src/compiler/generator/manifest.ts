/**
 * Manifest generator using GEMS graph-based IR.
 * Generates runtime binding metadata from graph structure.
 */
import type { 
  Graph, 
  ControllerNode, 
  OperationNode, 
  ParameterNode,
  NodeId 
} from "../graph/types.js";
import { getNodesByKind, getEdgesByRelation } from "../graph/types.js";
import type {
  ManifestV1,
  ControllerEntry,
  OperationEntry,
  ArgsSpec,
  BodyArgSpec,
  NamedArgSpec,
  ResponseSpec,
  HttpMethod,
} from "../manifest/format.js";

/**
 * Manifest generation options
 */
export interface ManifestGeneratorOptions {
  validationMode: "none" | "ajv-runtime" | "precompiled";
  version: string;
  typescriptVersion: string;
}

/**
 * Generate manifest from GEMS graph
 */
export function generateManifestFromGraph(
  graph: Graph,
  options: ManifestGeneratorOptions
): ManifestV1 {
  const controllers = getNodesByKind<ControllerNode>(graph, 'Controller');

  const controllerEntries: ControllerEntry[] = controllers.map(ctrl => 
    buildControllerEntry(graph, ctrl)
  );

  return {
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: {
      name: "adorn-api",
      version: options.version,
      typescript: options.typescriptVersion,
    },
    schemas: {
      kind: "openapi-3.1",
      file: "./openapi.json",
      componentsSchemasPointer: "/components/schemas",
    },
    validation: {
      mode: options.validationMode,
      precompiledModule: options.validationMode === "precompiled" ? null : null,
    },
    controllers: controllerEntries,
  };
}

/**
 * Build controller entry from graph
 */
function buildControllerEntry(
  graph: Graph,
  controller: ControllerNode
): ControllerEntry {
  const operations = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === controller.id);

  return {
    controllerId: controller.metadata.name,
    basePath: controller.controller.basePath,
    operations: operations.map(({ edge: containsEdge }) => {
      const opNode = graph.nodes.get(containsEdge.targetId);
      if (!opNode || opNode.kind !== 'Operation') {
        throw new Error(`Invalid operation node: ${containsEdge.targetId}`);
      }
      return buildOperationEntry(graph, opNode as OperationNode);
    }),
  };
}

/**
 * Build operation entry from graph
 */
function buildOperationEntry(
  graph: Graph,
  operation: OperationNode
): OperationEntry {
  const args: ArgsSpec = {
    body: null,
    path: [],
    query: [],
    headers: [],
    cookies: [],
  };

  buildPathArgs(graph, operation, args);
  buildQueryArgs(graph, operation, args);
  buildHeaderArgs(graph, operation, args);
  buildCookieArgs(graph, operation, args);
  buildBodyArgs(graph, operation, args);

  const responses = buildResponses(graph, operation);

  return {
    operationId: operation.operation.operationId,
    http: {
      method: operation.operation.httpMethod as HttpMethod,
      path: operation.operation.path,
    },
    handler: {
      methodName: operation.metadata.name,
    },
    args,
    responses,
  };
}

/**
 * Build path arguments
 */
function buildPathArgs(
  graph: Graph,
  operation: OperationNode,
  args: ArgsSpec
): void {
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    if (p.parameter.location === 'path') {
      args.path.push({
        name: p.metadata.name,
        index: p.parameter.index,
        required: !p.parameter.isOptional,
        schemaRef: getSchemaRef(graph, p.parameter.type),
        schemaType: getSchemaType(graph, p.parameter.type),
      });
    }
  }
}

/**
 * Build query arguments
 */
function buildQueryArgs(
  graph: Graph,
  operation: OperationNode,
  args: ArgsSpec
): void {
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    if (p.parameter.location === 'query') {
      args.query.push({
        name: p.metadata.name,
        index: p.parameter.index,
        required: !p.parameter.isOptional,
        schemaRef: getSchemaRef(graph, p.parameter.type),
        schemaType: getSchemaType(graph, p.parameter.type),
        content: isObjectLikeType(graph, p.parameter.type) 
          ? "application/json" 
          : undefined,
      });
    }
  }
}

/**
 * Build header arguments
 */
function buildHeaderArgs(
  graph: Graph,
  operation: OperationNode,
  args: ArgsSpec
): void {
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    if (p.parameter.location === 'header') {
      args.headers.push({
        name: p.metadata.name,
        index: p.parameter.index,
        required: !p.parameter.isOptional,
        schemaRef: getSchemaRef(graph, p.parameter.type),
        schemaType: getSchemaType(graph, p.parameter.type),
      });
    }
  }
}

/**
 * Build cookie arguments
 */
function buildCookieArgs(
  graph: Graph,
  operation: OperationNode,
  args: ArgsSpec
): void {
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    if (p.parameter.location === 'cookie') {
      args.cookies.push({
        name: p.metadata.name,
        index: p.parameter.index,
        required: !p.parameter.isOptional,
        schemaRef: getSchemaRef(graph, p.parameter.type),
        schemaType: getSchemaType(graph, p.parameter.type),
        serialization: { style: "form", explode: true },
      });
    }
  }
}

/**
 * Build body arguments
 */
function buildBodyArgs(
  graph: Graph,
  operation: OperationNode,
  args: ArgsSpec
): void {
  const paramEdges = getEdgesByRelation(graph, 'contains')
    .filter(e => e.sourceId === operation.id);

  for (const { edge: containsEdge } of paramEdges) {
    const paramNode = graph.nodes.get(containsEdge.targetId);
    if (!paramNode || paramNode.kind !== 'Parameter') continue;

    const p = paramNode as ParameterNode;
    if (p.parameter.location === 'body') {
      args.body = {
        index: p.parameter.index,
        required: !p.parameter.isOptional,
        contentType: "application/json",
        schemaRef: getSchemaRef(graph, p.parameter.type),
      };
    }
  }
}

/**
 * Build responses
 */
function buildResponses(
  graph: Graph,
  operation: OperationNode
): ResponseSpec[] {
  const statusCode = operation.operation.httpMethod === 'POST' ? 201 : 200;
  const schemaRef = getSchemaRef(graph, operation.operation.returnType);
  const isArray = isArrayType(graph, operation.operation.returnType);

  return [{
    status: statusCode,
    contentType: "application/json",
    schemaRef,
    isArray,
  }];
}

/**
 * Get schema reference for a type node
 */
function getSchemaRef(graph: Graph, nodeId: NodeId): string {
  const node = graph.nodes.get(nodeId);
  if (!node) return "#/components/schemas/InlineType";

  if (node.kind === 'TypeDefinition') {
    return `#/components/schemas/${node.metadata.name}`;
  }

  return "#/components/schemas/InlineType";
}

/**
 * Get schema type string
 */
function getSchemaType(graph: Graph, nodeId: NodeId): string | string[] {
  const node = graph.nodes.get(nodeId);
  if (!node) return "string";

  switch (node.kind) {
    case 'TypeDefinition':
      return "object";
    case 'SchemaComponent':
      return "object";
    case 'Enum':
      return "string";
    default:
      return "string";
  }
}

/**
 * Check if type is array
 */
function isArrayType(graph: Graph, nodeId: NodeId): boolean {
  const node = graph.nodes.get(nodeId);
  if (!node) return false;

  const usesEdges = getEdgesByRelation(graph, 'uses');
  return usesEdges.some(e => e.sourceId === nodeId);
}

/**
 * Check if type is object-like
 */
function isObjectLikeType(graph: Graph, nodeId: NodeId): boolean {
  const node = graph.nodes.get(nodeId);
  if (!node) return false;

  return node.kind === 'TypeDefinition' || node.kind === 'SchemaComponent';
}

/**
 * Generate manifest from GEMS compilation result
 */
export function generateManifest(
  graph: Graph,
  validationMode: "none" | "ajv-runtime" | "precompiled" = "ajv-runtime",
  version: string = "1.0.0",
  typescriptVersion: string = "5.0.0"
): ManifestV1 {
  return generateManifestFromGraph(graph, {
    validationMode,
    version,
    typescriptVersion,
  });
}
