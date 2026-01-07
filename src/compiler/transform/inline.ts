/**
 * Reference inlining transformation.
 * Inlines small type definitions to reduce schema complexity.
 */
import type { 
  AnyNode, 
  Graph,
  NodeId,
  GraphEdge 
} from "../graph/types.js";
import type { VisitorContext } from "../ir/visitor.js";

/**
 * Inlining configuration
 */
export interface InliningConfig {
  maxDepth: number;          // Maximum depth to inline
  maxNodes: number;          // Maximum nodes to inline
  inlinePrimitives: boolean;  // Inline primitive types
  inlineSmallTypes: boolean;   // Inline types with < N properties
  smallTypeThreshold: number;  // Threshold for "small" types
  excludePatterns: RegExp[];   // Exclude patterns from inlining
}

/**
 * Default inlining configuration
 */
export const DEFAULT_INLINING_CONFIG: InliningConfig = {
  maxDepth: 3,
  maxNodes: 100,
  inlinePrimitives: true,
  inlineSmallTypes: false,
  smallTypeThreshold: 3,
  excludePatterns: [/^(Body|Request|Response)/],
};

/**
 * Inlining transformation result
 */
export interface InliningResult {
  inlinedNodes: NodeId[];
  inlinedEdges: number;
  nodesRemoved: number;
}

/**
 * Create inlining transformer with custom config
 */
export function createInliningTransformer(config: Partial<InliningConfig> = {}) {
  const finalConfig = { ...DEFAULT_INLINING_CONFIG, ...config };

  return (node: AnyNode, context: VisitorContext): AnyNode | null => {
    // Only process nodes that reference other types
    if (!shouldInline(node, finalConfig)) {
      return node;
    }

    const nodesToRemove = context.metadata.get('nodesToRemove') as Set<NodeId> || new Set();
    nodesToRemove.add(node.id);
    context.metadata.set('nodesToRemove', nodesToRemove);

    return null; // Signal to remove this node and inline it
  };
}

/**
 * Apply inlining to graph
 */
export function applyInlining(
  graph: Graph,
  config: Partial<InliningConfig> = {}
): InliningResult {
  const finalConfig = { ...DEFAULT_INLINING_CONFIG, ...config };
  const inlinedNodes: NodeId[] = [];
  let inlinedEdges = 0;

  // Find nodes to inline
  const nodesToInline = findNodesToInline(graph, finalConfig);

  // Inline each node
  for (const nodeId of nodesToInline) {
    const inlined = inlineNode(graph, nodeId, finalConfig);
    if (inlined) {
      inlinedNodes.push(nodeId);
      inlinedEdges += inlined.edgesInlined;
    }
  }

  return {
    inlinedNodes,
    inlinedEdges,
    nodesRemoved: inlinedNodes.length,
  };
}

/**
 * Find nodes that should be inlined
 */
function findNodesToInline(
  graph: Graph,
  config: InliningConfig
): NodeId[] {
  const nodesToInline: NodeId[] = [];

  for (const [nodeId, node] of graph.nodes.entries()) {
    if (shouldInlineNode(graph, nodeId, node, config)) {
      nodesToInline.push(nodeId);
    }
  }

  return nodesToInline.slice(0, config.maxNodes);
}

/**
 * Check if a node should be inlined
 */
function shouldInlineNode(
  graph: Graph,
  nodeId: NodeId,
  node: AnyNode,
  config: InliningConfig
): boolean {
  // Check exclude patterns
  for (const pattern of config.excludePatterns) {
    if (pattern.test(node.metadata.name)) {
      return false;
    }
  }

  // Only inline type definitions
  if (node.kind !== 'TypeDefinition') {
    return false;
  }

  // Check if it's a primitive type
  const isPrimitive = isPrimitiveType(node);
  if (isPrimitive && !config.inlinePrimitives) {
    return false;
  }

  // Check if it's a small type
  if (config.inlineSmallTypes) {
    const propertyCount = getPropertyCount(node);
    if (propertyCount <= config.smallTypeThreshold) {
      return true;
    }
  }

  // Check usage count (inline if used only once)
  const usageCount = countUsages(graph, nodeId);
  if (usageCount <= 1) {
    return true;
  }

  return false;
}

/**
 * Check if a node is a primitive type
 */
function isPrimitiveType(node: AnyNode): boolean {
  if (node.kind !== 'TypeDefinition') return false;

  const primitives = [
    'string', 'number', 'boolean', 'any', 'unknown', 'void', 'null',
    'String', 'Number', 'Boolean', 'Any', 'Unknown',
  ];

  return primitives.includes(node.metadata.name);
}

/**
 * Get property count from type definition
 */
function getPropertyCount(node: AnyNode): number {
  if (node.kind !== 'TypeDefinition') return 0;
  
  if (node.typeDef.properties) {
    return node.typeDef.properties.size;
  }

  return 0;
}

/**
 * Count how many nodes reference a given node
 */
function countUsages(graph: Graph, nodeId: NodeId): number {
  let count = 0;

  for (const node of graph.nodes.values()) {
    for (const edge of node.edges) {
      if (edge.targetId === nodeId) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Inline a node into its usages
 */
function inlineNode(
  graph: Graph,
  nodeId: NodeId,
  config: InliningConfig
): { success: boolean; edgesInlined: number } | null {
  const node = graph.nodes.get(nodeId);
  if (!node) return null;

  // Find all usages
  const usages: { sourceId: NodeId; edge: GraphEdge }[] = [];
  for (const [sourceId, sourceNode] of graph.nodes.entries()) {
    for (let i = 0; i < sourceNode.edges.length; i++) {
      const edge = sourceNode.edges[i];
      if (edge.targetId === nodeId) {
        usages.push({ sourceId, edge });
      }
    }
  }

  if (usages.length === 0) {
    return { success: false, edgesInlined: 0 };
  }

  // Inline the node's properties into each usage
  for (const { sourceId, edge } of usages) {
    const sourceNode = graph.nodes.get(sourceId);
    if (!sourceNode) continue;

    // Add inline marker to edge
    edge.properties = edge.properties || {};
    edge.properties.inlined = true;
    edge.properties.inlinedFrom = nodeId;
  }

  // Remove the inlined node
  graph.nodes.delete(nodeId);

  return {
    success: true,
    edgesInlined: usages.length,
  };
}

/**
 * Check if a node should be inlined during traversal
 */
function shouldInline(node: AnyNode, config: InliningConfig): boolean {
  if (node.kind !== 'TypeDefinition') return false;

  // Check exclude patterns
  for (const pattern of config.excludePatterns) {
    if (pattern.test(node.metadata.name)) {
      return false;
    }
  }

  return isPrimitiveType(node) || getPropertyCount(node) <= config.smallTypeThreshold;
}

/**
 * Calculate inlining depth for a node
 */
export function calculateInliningDepth(
  graph: Graph,
  nodeId: NodeId,
  visited: Set<NodeId> = new Set()
): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const node = graph.nodes.get(nodeId);
  if (!node) return 0;

  let maxDepth = 0;
  for (const edge of node.edges) {
    if (edge.relation === 'uses') {
      const depth = calculateInliningDepth(graph, edge.targetId, visited);
      maxDepth = Math.max(maxDepth, depth + 1);
    }
  }

  return maxDepth;
}

/**
 * Find potential inline candidates
 */
export function findInlineCandidates(
  graph: Graph,
  config: Partial<InliningConfig> = {}
): NodeId[] {
  const finalConfig = { ...DEFAULT_INLINING_CONFIG, ...config };
  const candidates: NodeId[] = [];

  for (const [nodeId, node] of graph.nodes.entries()) {
    if (shouldInlineNode(graph, nodeId, node, finalConfig)) {
      const depth = calculateInliningDepth(graph, nodeId);
      if (depth <= finalConfig.maxDepth) {
        candidates.push(nodeId);
      }
    }
  }

  return candidates.sort((a, b) => {
    const depthA = calculateInliningDepth(graph, a);
    const depthB = calculateInliningDepth(graph, b);
    return depthA - depthB;
  });
}
