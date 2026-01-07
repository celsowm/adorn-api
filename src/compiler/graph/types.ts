/**
 * Graph-Based Intermediate Representation (GBIR) type definitions.
 * Provides the core data structures for the graph-based compiler architecture.
 */

/**
 * Unique identifier for a node in the graph
 */
export type NodeId = string;

/**
 * All possible node kinds in the compiler graph
 */
export type NodeKind =
  | 'TypeDefinition'
  | 'Controller'
  | 'Operation'
  | 'Parameter'
  | 'SchemaComponent'
  | 'Validator'
  | 'Interface'
  | 'Enum'
  | 'Union'
  | 'Intersection';

/**
 * Relationship types between graph nodes
 */
export type EdgeRelation =
  | 'uses'           // Type usage relationship
  | 'extends'        // Inheritance/extension
  | 'implements'     // Interface implementation
  | 'validates'      // Schema validation
  | 'references'     // Cross-reference
  | 'dependsOn'      // Dependency
  | 'generates'      // Output generation
  | 'annotates'      // Decorator/annotation
  | 'contains';      // Containment (parent-child)

/**
 * Edge in the graph with metadata
 */
export interface GraphEdge {
  targetId: NodeId;
  relation: EdgeRelation;
  properties?: Record<string, unknown>;
  weight?: number;
}

/**
 * Source location for debugging and error reporting
 */
export interface SourceLocation {
  filePath: string;
  line: number;
  column: number;
}

/**
 * Node metadata shared across all node types
 */
export interface NodeMetadata {
  name: string;
  sourceLocation: SourceLocation;
  tags?: Set<string>;
  annotations?: Map<string, unknown>;
}

/**
 * Base interface for all graph nodes
 */
export interface GraphNode {
  id: NodeId;
  kind: NodeKind;
  metadata: NodeMetadata;
  edges: GraphEdge[];
}

/**
 * Type definition node (class, interface, type alias)
 */
export interface TypeDefinitionNode extends GraphNode {
  kind: 'TypeDefinition';
  typeDef: {
    isGeneric: boolean;
    typeParameters?: string[];
    properties?: Map<string, NodeId>;
  };
}

/**
 * Controller node representing a controller class
 */
export interface ControllerNode extends GraphNode {
  kind: 'Controller';
  controller: {
    basePath: string;
    consumes?: string[];
    produces?: string[];
  };
}

/**
 * Operation node representing an HTTP endpoint
 */
export interface OperationNode extends GraphNode {
  kind: 'Operation';
  operation: {
    httpMethod: string;
    path: string;
    operationId: string;
    returnType: NodeId;
  };
}

/**
 * Parameter node for operation parameters
 */
export interface ParameterNode extends GraphNode {
  kind: 'Parameter';
  parameter: {
    index: number;
    location: 'path' | 'query' | 'body' | 'header' | 'cookie';
    type: NodeId;
    isOptional: boolean;
  };
}

/**
 * Schema component node (for OpenAPI/JSON Schema components)
 */
export interface SchemaComponentNode extends GraphNode {
  kind: 'SchemaComponent';
  schema: {
    schemaType: 'object' | 'array' | 'primitive' | 'enum' | 'union' | 'intersection';
    definition: unknown; // JsonSchema
    isExternal: boolean;
  };
}

/**
 * Validator node for runtime validation
 */
export interface ValidatorNode extends GraphNode {
  kind: 'Validator';
  validator: {
    schemaRef: NodeId;
    mode: 'ajv-runtime' | 'precompiled';
  };
}

/**
 * Interface definition node
 */
export interface InterfaceNode extends GraphNode {
  kind: 'Interface';
  interfaceDef: {
    methods?: Map<string, NodeId>;
  };
}

/**
 * Enum definition node
 */
export interface EnumNode extends GraphNode {
  kind: 'Enum';
  enumDef: {
    values: string[];
  };
}

/**
 * Union type node
 */
export interface UnionNode extends GraphNode {
  kind: 'Union';
  union: {
    types: NodeId[];
  };
}

/**
 * Intersection type node
 */
export interface IntersectionNode extends GraphNode {
  kind: 'Intersection';
  intersection: {
    types: NodeId[];
  };
}

/**
 * Union type for all possible graph nodes
 */
export type AnyNode =
  | TypeDefinitionNode
  | ControllerNode
  | OperationNode
  | ParameterNode
  | SchemaComponentNode
  | ValidatorNode
  | InterfaceNode
  | EnumNode
  | UnionNode
  | IntersectionNode;

/**
 * The main graph structure containing nodes and relationships
 */
export interface Graph {
  nodes: Map<NodeId, AnyNode>;
  roots: Set<NodeId>;
  version: string;
  metadata: {
    createdAt: string;
    generatedBy: string;
    tsVersion?: string;
  };
}

/**
 * Create a new empty graph
 */
export function createGraph(tsVersion?: string): Graph {
  return {
    nodes: new Map(),
    roots: new Set(),
    version: '1.0.0',
    metadata: {
      createdAt: new Date().toISOString(),
      generatedBy: 'adorn-api-gems',
      tsVersion,
    },
  };
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(kind: NodeKind, name: string): NodeId {
  return `${kind}:${name}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a node to the graph
 */
export function addNode(graph: Graph, node: AnyNode): void {
  graph.nodes.set(node.id, node);
}

/**
 * Remove a node from the graph
 */
export function removeNode(graph: Graph, nodeId: NodeId): void {
  const node = graph.nodes.get(nodeId);
  if (!node) return;

  graph.nodes.delete(nodeId);
  graph.roots.delete(nodeId);

  for (const [id, otherNode] of graph.nodes.entries()) {
    otherNode.edges = otherNode.edges.filter(edge => edge.targetId !== nodeId);
  }
}

/**
 * Add an edge between two nodes
 */
export function addEdge(
  graph: Graph,
  sourceId: NodeId,
  targetId: NodeId,
  relation: EdgeRelation,
  properties?: Record<string, unknown>
): void {
  const sourceNode = graph.nodes.get(sourceId);
  if (!sourceNode) {
    throw new Error(`Source node ${sourceId} not found`);
  }

  const targetExists = graph.nodes.has(targetId);
  if (!targetExists) {
    throw new Error(`Target node ${targetId} not found`);
  }

  sourceNode.edges.push({
    targetId,
    relation,
    properties,
  });
}

/**
 * Get all nodes of a specific kind
 */
export function getNodesByKind<T extends AnyNode>(
  graph: Graph,
  kind: T['kind']
): T[] {
  return Array.from(graph.nodes.values())
    .filter(node => node.kind === kind) as T[];
}

/**
 * Get all edges of a specific relation type
 */
export function getEdgesByRelation(
  graph: Graph,
  relation: EdgeRelation
): { sourceId: NodeId; edge: GraphEdge }[] {
  const edges: { sourceId: NodeId; edge: GraphEdge }[] = [];

  for (const [id, node] of graph.nodes.entries()) {
    for (const edge of node.edges) {
      if (edge.relation === relation) {
        edges.push({ sourceId: id, edge });
      }
    }
  }

  return edges;
}
