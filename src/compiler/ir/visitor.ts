/**
 * Visitor pattern for graph transformations.
 * Provides flexible way to traverse and transform graph nodes.
 */
import type { 
  GraphNode, 
  GraphEdge, 
  AnyNode, 
  NodeKind 
} from "../graph/types.js";
import type { Graph } from "../graph/types.js";

/**
 * Visitor context for tracking state during traversal
 */
export interface VisitorContext {
  graph: Graph;
  visited: Set<string>;
  skipChildren: boolean;
  replacements: Map<string, AnyNode>;
  metadata: Map<string, unknown>;
}

/**
 * Create a new visitor context
 */
export function createVisitorContext(graph: Graph): VisitorContext {
  return {
    graph,
    visited: new Set(),
    skipChildren: false,
    replacements: new Map(),
    metadata: new Map(),
  };
}

/**
 * Base visitor interface
 */
export interface GraphVisitor {
  visitNode?(node: AnyNode, context: VisitorContext): AnyNode | null | void;
  visitEdge?(edge: GraphEdge, sourceId: string, context: VisitorContext): GraphEdge | null | void;
  beforeTraversal?(context: VisitorContext): void;
  afterTraversal?(context: VisitorContext): void;
}

/**
 * Node transformer for specific node kinds
 */
export type NodeTransformer = (
  node: AnyNode,
  context: VisitorContext
) => AnyNode | null | void;

/**
 * Edge transformer
 */
export type EdgeTransformer = (
  edge: GraphEdge,
  sourceId: string,
  context: VisitorContext
) => GraphEdge | null | void;

/**
 * Transforming visitor that applies transformations to nodes and edges
 */
export class TransformingVisitor implements GraphVisitor {
  private nodeTransformers: Map<NodeKind, NodeTransformer> = new Map();
  private edgeTransformer?: EdgeTransformer;
  private beforeCallback?: (context: VisitorContext) => void;
  private afterCallback?: (context: VisitorContext) => void;

  /**
   * Register a transformer for a specific node kind
   */
  registerTransformer(kind: NodeKind, transformer: NodeTransformer): void {
    this.nodeTransformers.set(kind, transformer);
  }

  /**
   * Register a transformer for all edges
   */
  registerEdgeTransformer(transformer: EdgeTransformer): void {
    this.edgeTransformer = transformer;
  }

  /**
   * Set callback before traversal
   */
  onBeforeTraversal(callback: (context: VisitorContext) => void): void {
    this.beforeCallback = callback;
  }

  /**
   * Set callback after traversal
   */
  onAfterTraversal(callback: (context: VisitorContext) => void): void {
    this.afterCallback = callback;
  }

  visitNode(node: AnyNode, context: VisitorContext): AnyNode | null {
    const transformer = this.nodeTransformers.get(node.kind);
    if (transformer) {
      const result = transformer(node, context);
      return result === null ? null : (result ?? node);
    }
    return node;
  }

  visitEdge(edge: GraphEdge, sourceId: string, context: VisitorContext): GraphEdge | null {
    if (this.edgeTransformer) {
      const result = this.edgeTransformer(edge, sourceId, context);
      return result === null ? null : (result ?? edge);
    }
    return edge;
  }

  beforeTraversal(context: VisitorContext): void {
    this.beforeCallback?.(context);
  }

  afterTraversal(context: VisitorContext): void {
    this.afterCallback?.(context);
  }
}

/**
 * Compose multiple visitors together
 */
export class CompositeVisitor implements GraphVisitor {
  private visitors: GraphVisitor[];

  constructor(...visitors: GraphVisitor[]) {
    this.visitors = visitors;
  }

  addVisitor(visitor: GraphVisitor): void {
    this.visitors.push(visitor);
  }

  visitNode(node: AnyNode, context: VisitorContext): AnyNode | null {
    let currentNode = node;
    for (const visitor of this.visitors) {
      if (visitor.visitNode) {
        const result = visitor.visitNode(currentNode, context);
        if (result === null) return null;
        if (result !== undefined) {
          currentNode = result;
        }
      }
    }
    return currentNode;
  }

  visitEdge(edge: GraphEdge, sourceId: string, context: VisitorContext): GraphEdge | null {
    let currentEdge = edge;
    for (const visitor of this.visitors) {
      if (visitor.visitEdge) {
        const result = visitor.visitEdge(currentEdge, sourceId, context);
        if (result === null) return null;
        if (result !== undefined) {
          currentEdge = result;
        }
      }
    }
    return currentEdge;
  }

  beforeTraversal(context: VisitorContext): void {
    for (const visitor of this.visitors) {
      visitor.beforeTraversal?.(context);
    }
  }

  afterTraversal(context: VisitorContext): void {
    for (const visitor of this.visitors) {
      visitor.afterTraversal?.(context);
    }
  }
}

/**
 * Traverse the graph with a visitor
 */
export function traverseGraph(
  graph: Graph,
  visitor: GraphVisitor,
  options?: { 
    order?: 'preorder' | 'postorder' | 'levelorder';
    startNodes?: Set<string>;
  }
): Graph {
  const context = createVisitorContext(graph);
  const order = options?.order || 'preorder';
  const startNodes = options?.startNodes || graph.roots;

  visitor.beforeTraversal?.(context);

  // Perform traversal based on order
  if (order === 'preorder') {
    traversePreorder(graph, startNodes, visitor, context);
  } else if (order === 'postorder') {
    traversePostorder(graph, startNodes, visitor, context);
  } else if (order === 'levelorder') {
    traverseLevelorder(graph, startNodes, visitor, context);
  }

  visitor.afterTraversal?.(context);

  // Apply replacements
  for (const [nodeId, newNode] of context.replacements) {
    graph.nodes.set(nodeId, newNode);
  }

  return graph;
}

/**
 * Preorder traversal (depth-first)
 */
function traversePreorder(
  graph: Graph,
  startNodes: Set<string>,
  visitor: GraphVisitor,
  context: VisitorContext
): void {
  const visited = new Set<string>();

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    if (context.skipChildren) return;

    // Visit node
    const transformed = visitor.visitNode?.(node as any, context);
    if (transformed === null) return;
    if (transformed && transformed !== node) {
      context.replacements.set(nodeId, transformed as any);
    }

    // Visit edges
    for (const edge of node.edges) {
      const transformedEdge = visitor.visitEdge?.(edge, nodeId, context);
      if (transformedEdge) {
        // Update edge if transformed
      }

      visit(edge.targetId);
    }
  };

  for (const startNodeId of startNodes) {
    visit(startNodeId);
  }
}

/**
 * Postorder traversal
 */
function traversePostorder(
  graph: Graph,
  startNodes: Set<string>,
  visitor: GraphVisitor,
  context: VisitorContext
): void {
  const visited = new Set<string>();

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    if (context.skipChildren) return;

    // Visit children first
    for (const edge of node.edges) {
      visit(edge.targetId);
    }

    // Then visit node
    const transformed = visitor.visitNode?.(node as any, context);
    if (transformed === null) return;
    if (transformed && transformed !== node) {
      context.replacements.set(nodeId, transformed as any);
    }
  };

  for (const startNodeId of startNodes) {
    visit(startNodeId);
  }
}

/**
 * Level-order (BFS) traversal
 */
function traverseLevelorder(
  graph: Graph,
  startNodes: Set<string>,
  visitor: GraphVisitor,
  context: VisitorContext
): void {
  const visited = new Set<string>();
  const queue: string[] = Array.from(startNodes);

  for (const nodeId of startNodes) {
    visited.add(nodeId);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    if (context.skipChildren) return;

    // Visit node
    const transformed = visitor.visitNode?.(node as any, context);
    if (transformed === null) continue;
    if (transformed && transformed !== node) {
      context.replacements.set(nodeId, transformed as any);
    }

    // Visit edges
    for (const edge of node.edges) {
      visitor.visitEdge?.(edge, nodeId, context);

      if (!visited.has(edge.targetId)) {
        visited.add(edge.targetId);
        queue.push(edge.targetId);
      }
    }
  }
}

/**
 * Filter visitor that only visits nodes matching a predicate
 */
export class FilterVisitor implements GraphVisitor {
  private predicate: (node: AnyNode) => boolean;
  private innerVisitor: GraphVisitor;

  constructor(predicate: (node: AnyNode) => boolean, innerVisitor: GraphVisitor) {
    this.predicate = predicate;
    this.innerVisitor = innerVisitor;
  }

  visitNode(node: AnyNode, context: VisitorContext): AnyNode | null {
    if (this.predicate(node)) {
      return this.innerVisitor.visitNode?.(node, context) ?? null;
    }
    return node;
  }

  visitEdge(edge: GraphEdge, sourceId: string, context: VisitorContext): GraphEdge | null {
    const node = context.graph.nodes.get(sourceId);
    if (node && this.predicate(node)) {
      return this.innerVisitor.visitEdge?.(edge, sourceId, context) ?? null;
    }
    return edge;
  }

  beforeTraversal(context: VisitorContext): void {
    this.innerVisitor.beforeTraversal?.(context);
  }

  afterTraversal(context: VisitorContext): void {
    this.innerVisitor.afterTraversal?.(context);
  }
}
