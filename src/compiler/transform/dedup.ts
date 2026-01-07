/**
 * Deduplication transformation for removing duplicate type definitions.
 * Merges identical types and updates references.
 */
import type { 
  AnyNode, 
  TypeDefinitionNode, 
  Graph,
  NodeId 
} from "../graph/types.js";
import type { VisitorContext, NodeTransformer } from "../ir/visitor.js";
import { removeNode, addEdge } from "../graph/types.js";

/**
 * Type similarity comparison result
 */
interface TypeSimilarity {
  score: number; // 0-1, higher is more similar
  identical: boolean;
}

/**
 * Deduplication transformation result
 */
export interface DeduplicationResult {
  mergedNodes: Map<NodeId, NodeId>; // oldId -> newId
  removedCount: number;
  duplicatesFound: number;
}

/**
 * Type deduplication transformer
 */
export function createDeduplicationTransformer(): NodeTransformer {
  return (node: AnyNode, context: VisitorContext): AnyNode | null => {
    if (node.kind !== 'TypeDefinition') return node;

    // Find duplicates in context metadata
    const duplicates = context.metadata.get('duplicates') as Map<string, NodeId[]> || new Map();

    const typeName = node.metadata.name;
    if (!duplicates.has(typeName)) {
      duplicates.set(typeName, []);
    }

    const nodes = duplicates.get(typeName)!;
    nodes.push(node.id);
    duplicates.set(typeName, nodes);

    return node;
  };
}

/**
 * Apply deduplication to graph
 */
export function applyDeduplication(graph: Graph): DeduplicationResult {
  const typeDefs = new Map<string, TypeDefinitionNode[]>();
  
  // Group type definitions by name
  for (const node of graph.nodes.values()) {
    if (node.kind === 'TypeDefinition') {
      const typeName = node.metadata.name;
      if (!typeDefs.has(typeName)) {
        typeDefs.set(typeName, []);
      }
      typeDefs.get(typeName)!.push(node);
    }
  }

  const mergedNodes = new Map<NodeId, NodeId>();
  let duplicatesFound = 0;
  let removedCount = 0;

  // Find and merge duplicates
  for (const [typeName, nodes] of typeDefs.entries()) {
    if (nodes.length > 1) {
      duplicatesFound += nodes.length - 1;

      // Find most complete definition (most properties, etc.)
      const primaryNode = nodes.reduce((best, current) => {
        const bestScore = calculateTypeScore(best);
        const currentScore = calculateTypeScore(current);
        return currentScore > bestScore ? current : best;
      });

      // Merge into primary
      for (const node of nodes) {
        if (node.id !== primaryNode.id) {
          mergeReferences(graph, node.id, primaryNode.id);
          removeNode(graph, node.id);
          mergedNodes.set(node.id, primaryNode.id);
          removedCount++;
        }
      }
    }
  }

  return {
    mergedNodes,
    removedCount,
    duplicatesFound,
  };
}

/**
 * Calculate score for type definition (higher = more complete)
 */
function calculateTypeScore(node: TypeDefinitionNode): number {
  let score = 0;

  if (node.typeDef.properties) {
    score += node.typeDef.properties.size * 10;
  }

  if (node.metadata.tags) {
    score += node.metadata.tags.size * 2;
  }

  if (node.typeDef.isGeneric) {
    score += 5;
  }

  return score;
}

/**
 * Merge references from oldNodeId to newNodeId
 */
function mergeReferences(
  graph: Graph,
  oldNodeId: NodeId,
  newNodeId: NodeId
): void {
  for (const node of graph.nodes.values()) {
    for (const edge of node.edges) {
      if (edge.targetId === oldNodeId) {
        // Replace reference
        const oldEdge = edge;
        edge.targetId = newNodeId;
      }
    }
  }
}

/**
 * Find structurally similar types
 */
export function findSimilarTypes(
  graph: Graph,
  threshold: number = 0.8
): Array<[NodeId, NodeId, TypeSimilarity]> {
  const similarities: Array<[NodeId, NodeId, TypeSimilarity]> = [];
  const typeNodes: TypeDefinitionNode[] = [];

  for (const node of graph.nodes.values()) {
    if (node.kind === 'TypeDefinition') {
      typeNodes.push(node);
    }
  }

  for (let i = 0; i < typeNodes.length; i++) {
    for (let j = i + 1; j < typeNodes.length; j++) {
      const similarity = compareTypes(typeNodes[i], typeNodes[j]);
      if (similarity.score >= threshold && !similarity.identical) {
        similarities.push([
          typeNodes[i].id,
          typeNodes[j].id,
          similarity,
        ]);
      }
    }
  }

  return similarities;
}

/**
 * Compare two type definitions for similarity
 */
function compareTypes(
  type1: TypeDefinitionNode,
  type2: TypeDefinitionNode
): TypeSimilarity {
  let score = 0;
  let total = 0;

  // Compare name similarity (fuzzy)
  const nameSimilarity = calculateStringSimilarity(
    type1.metadata.name,
    type2.metadata.name
  );
  score += nameSimilarity * 10;
  total += 10;

  // Compare generic status
  if (type1.typeDef.isGeneric === type2.typeDef.isGeneric) {
    score += 5;
  }
  total += 5;

  // Compare properties
  if (type1.typeDef.properties && type2.typeDef.properties) {
    const props1 = Array.from(type1.typeDef.properties.keys());
    const props2 = Array.from(type2.typeDef.properties.keys());
    
    const intersection = props1.filter(p => props2.includes(p));
    const union = new Set([...props1, ...props2] as string[]);
    
    const propertySimilarity = intersection.length / union.size;
    score += propertySimilarity * 50;
    total += 50;
  }

  return {
    score: total > 0 ? score / total : 0,
    identical: score === total && total > 0,
  };
}

/**
 * Calculate string similarity (simple Levenshtein-based)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshtein(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
