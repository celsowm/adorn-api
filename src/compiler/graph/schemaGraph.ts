/**
 * Schema graph operations for advanced schema management.
 * Provides graph algorithms for schema optimization and analysis.
 */
import type { Graph, NodeId, EdgeRelation } from "./types.js";
import { addEdge, getEdgesByRelation } from "./types.js";

/**
 * Schema-specific graph with advanced operations
 */
export class SchemaGraph {
  private graph: Graph;
  private adjacency: Map<NodeId, Set<NodeId>> = new Map();
  private reverseAdjacency: Map<NodeId, Set<NodeId>> = new Map();

  constructor(graph: Graph) {
    this.graph = graph;
    this.buildAdjacencyLists();
  }

  /**
   * Build adjacency lists for faster traversal
   */
  private buildAdjacencyLists(): void {
    for (const [id, node] of this.graph.nodes.entries()) {
      this.adjacency.set(id, new Set());
      this.reverseAdjacency.set(id, new Set());
    }

    for (const [sourceId, node] of this.graph.nodes.entries()) {
      for (const edge of node.edges) {
        this.adjacency.get(sourceId)?.add(edge.targetId);
        this.reverseAdjacency.get(edge.targetId)?.add(sourceId);
      }
    }
  }

  /**
   * Find all nodes that use a given type
   */
  findTypeUsages(typeId: NodeId): NodeId[] {
    const usages: NodeId[] = [];
    const usesEdges = getEdgesByRelation(this.graph, 'uses');

    for (const { sourceId, edge } of usesEdges) {
      if (edge.targetId === typeId) {
        usages.push(sourceId);
      }
    }

    return usages;
  }

  /**
   * Detect cycles in the dependency graph
   */
  detectCycles(): CycleReport {
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    const cycles: NodeId[][] = [];

    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        this.detectCyclesDFS(nodeId, visited, recursionStack, [], cycles);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
      cycleCount: cycles.length,
    };
  }

  /**
   * Depth-first search for cycle detection
   */
  private detectCyclesDFS(
    nodeId: NodeId,
    visited: Set<NodeId>,
    recursionStack: Set<NodeId>,
    path: NodeId[],
    cycles: NodeId[][]
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = this.adjacency.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.detectCyclesDFS(neighbor, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   */
  findStronglyConnectedComponents(): NodeId[][] {
    let index = 0;
    const stack: NodeId[] = [];
    const indices = new Map<NodeId, number>();
    const lowlinks = new Map<NodeId, number>();
    const onStack = new Set<NodeId>();
    const sccs: NodeId[][] = [];

    const strongConnect = (v: NodeId): void => {
      indices.set(v, index);
      lowlinks.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      const neighbors = this.adjacency.get(v) || new Set();
      for (const w of neighbors) {
        if (!indices.has(w)) {
          strongConnect(w);
          lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
        } else if (onStack.has(w)) {
          lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
        }
      }

      if (lowlinks.get(v) === indices.get(v)) {
        const scc: NodeId[] = [];
        let w: NodeId | undefined;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== v);
        sccs.push(scc);
      }
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!indices.has(nodeId)) {
        strongConnect(nodeId);
      }
    }

    return sccs;
  }

  /**
   * Topological sort of the graph
   */
  topologicalSort(): NodeId[] {
    const inDegree = new Map<NodeId, number>();
    
    for (const nodeId of this.graph.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const [sourceId, node] of this.graph.nodes.entries()) {
      for (const edge of node.edges) {
        inDegree.set(
          edge.targetId,
          (inDegree.get(edge.targetId) || 0) + 1
        );
      }
    }

    const queue: NodeId[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sorted: NodeId[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const neighbors = this.adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sorted;
  }

  /**
   * Find nodes reachable from a given start node
   */
  findReachable(startNodeId: NodeId): Set<NodeId> {
    const reachable = new Set<NodeId>();
    const visited = new Set<NodeId>();
    const queue: NodeId[] = [startNodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      reachable.add(current);

      const neighbors = this.adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return reachable;
  }

  /**
   * Find shortest path between two nodes (BFS)
   */
  findShortestPath(fromId: NodeId, toId: NodeId): NodeId[] | null {
    const visited = new Set<NodeId>();
    const previous = new Map<NodeId, NodeId>();
    const queue: NodeId[] = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === toId) {
        return this.reconstructPath(previous, toId);
      }

      const neighbors = this.adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          previous.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    return null;
  }

  /**
   * Reconstruct path from previous map
   */
  private reconstructPath(
    previous: Map<NodeId, NodeId>,
    toId: NodeId
  ): NodeId[] {
    const path: NodeId[] = [toId];
    let current: NodeId | undefined = toId;

    while (current !== undefined) {
      current = previous.get(current);
      if (current !== undefined) {
        path.unshift(current);
      }
    }

    return path;
  }

  /**
   * Get nodes grouped by their depth from roots
   */
  getDepthGroups(): Map<number, NodeId[]> {
    const depths = new Map<NodeId, number>();
    const groups = new Map<number, NodeId[]>();

    // Calculate depths using BFS from all roots
    for (const rootId of this.graph.roots) {
      const queue: NodeId[] = [rootId];
      depths.set(rootId, 0);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentDepth = depths.get(current)!;

        for (const neighbor of (this.adjacency.get(current) || new Set())) {
          const newDepth = currentDepth + 1;
          if (
            !depths.has(neighbor) || 
            depths.get(neighbor)! > newDepth
          ) {
            depths.set(neighbor, newDepth);
            queue.push(neighbor);
          }
        }
      }
    }

    // Group nodes by depth
    for (const [nodeId, depth] of depths.entries()) {
      if (!groups.has(depth)) {
        groups.set(depth, []);
      }
      groups.get(depth)!.push(nodeId);
    }

    return groups;
  }

  /**
   * Get the underlying graph
   */
  getGraph(): Graph {
    return this.graph;
  }
}

/**
 * Cycle detection report
 */
export interface CycleReport {
  hasCycles: boolean;
  cycles: NodeId[][];
  cycleCount: number;
}
