/**
 * Flattening transformation for simplifying nested type structures.
 * Flattens deeply nested object types into shallower structures.
 */
import type { 
  AnyNode, 
  TypeDefinitionNode,
  Graph,
  NodeId 
} from "../graph/types.js";
import type { VisitorContext, NodeTransformer } from "../ir/visitor.js";
import { addEdge } from "../graph/types.js";

/**
 * Flattening configuration
 */
export interface FlattenConfig {
  maxNestingLevel: number;
  preserveNaming: boolean;      // Keep original property names
  prefix: string;               // Prefix for flattened properties
  mergeOverlapping: boolean;    // Merge overlapping properties
  maxProperties: number;         // Limit total properties
}

/**
 * Default flattening configuration
 */
export const DEFAULT_FLATTEN_CONFIG: FlattenConfig = {
  maxNestingLevel: 3,
  preserveNaming: true,
  prefix: '_',
  mergeOverlapping: true,
  maxProperties: 100,
};

/**
 * Flattening transformation result
 */
export interface FlattenResult {
  flattenedNodes: NodeId[];
  propertiesFlattened: number;
  conflictsResolved: number;
}

/**
 * Create flattening transformer
 */
export function createFlattenTransformer(
  config: Partial<FlattenConfig> = {}
): NodeTransformer {
  const finalConfig = { ...DEFAULT_FLATTEN_CONFIG, ...config };

  return (node: AnyNode, context: VisitorContext): AnyNode | null => {
    if (node.kind !== 'TypeDefinition') return node;

    const depth = context.metadata.get('depth') as number || 0;
    if (depth >= finalConfig.maxNestingLevel) {
      return node; // Don't flatten beyond max depth
    }

    return flattenTypeNode(node, finalConfig);
  };
}

/**
 * Flatten a type definition node
 */
function flattenTypeNode(
  node: TypeDefinitionNode,
  config: FlattenConfig
): TypeDefinitionNode {
  const flattened = { ...node };
  const newProperties = new Map(node.typeDef.properties || new Map());

  // Check each property
  if (node.typeDef.properties) {
    for (const [propName, propTypeId] of node.typeDef.properties) {
      // Property would be flattened in actual implementation
      // For now, just track it
    }
  }

  flattened.typeDef = {
    ...flattened.typeDef,
    properties: newProperties,
  };

  return flattened;
}

/**
 * Apply flattening to graph
 */
export function applyFlattening(
  graph: Graph,
  config: Partial<FlattenConfig> = {}
): FlattenResult {
  const finalConfig = { ...DEFAULT_FLATTEN_CONFIG, ...config };
  const flattenedNodes: NodeId[] = [];
  let propertiesFlattened = 0;
  let conflictsResolved = 0;

  // Find nested type definitions
  const typeNodes = Array.from(graph.nodes.values())
    .filter(n => n.kind === 'TypeDefinition') as TypeDefinitionNode[];

  for (const node of typeNodes) {
    const result = flattenType(graph, node, finalConfig);
    if (result.propertiesFlattened > 0) {
      flattenedNodes.push(node.id);
      propertiesFlattened += result.propertiesFlattened;
      conflictsResolved += result.conflictsResolved;
    }
  }

  return {
    flattenedNodes,
    propertiesFlattened,
    conflictsResolved,
  };
}

/**
 * Flatten a type definition in the graph
 */
function flattenType(
  graph: Graph,
  node: TypeDefinitionNode,
  config: FlattenConfig
): { propertiesFlattened: number; conflictsResolved: number } {
  let propertiesFlattened = 0;
  let conflictsResolved = 0;

  if (!node.typeDef.properties || node.typeDef.properties.size === 0) {
    return { propertiesFlattened: 0, conflictsResolved: 0 };
  }

  const newProperties = new Map(node.typeDef.properties);
  const flattened = new Map<string, NodeId>();

  // Iterate through properties and check for nested types
  for (const [propName, propTypeId] of node.typeDef.properties) {
    const propType = graph.nodes.get(propTypeId);
    
    if (!propType || propType.kind !== 'TypeDefinition') {
      continue;
    }

    const nestedType = propType as TypeDefinitionNode;

    // Check if this type should be flattened
    if (shouldFlattenType(nestedType, config)) {
      // Flatten nested properties into this type
      const nestingLevel = calculateNestingLevel(graph, nestedType);
      
      if (nestingLevel < config.maxNestingLevel) {
        for (const [nestedPropName, nestedPropTypeId] of 
             (nestedType.typeDef.properties || new Map()).entries()) {
          
          const flattenedName = config.preserveNaming 
            ? `${propName}${nestedPropName.charAt(0).toUpperCase() + nestedPropName.slice(1)}`
            : `${config.prefix}${propName}${config.prefix}${nestedPropName}`;
          
          // Check for conflicts
          if (newProperties.has(flattenedName) && !config.mergeOverlapping) {
            // Conflict found - skip this property
            conflictsResolved++;
            continue;
          }

          newProperties.set(flattenedName, nestedPropTypeId);
          flattened.set(flattenedName, nestedPropTypeId);
          propertiesFlattened++;
        }
      }
    }
  }

  // Update the node if properties were flattened
  if (flattened.size > 0) {
    node.typeDef = {
      ...node.typeDef,
      properties: newProperties,
    };
  }

  return { propertiesFlattened, conflictsResolved };
}

/**
 * Check if a type should be flattened
 */
function shouldFlattenType(
  node: TypeDefinitionNode,
  config: FlattenConfig
): boolean {
  // Don't flatten if it has too many properties
  if (node.typeDef.properties && 
      node.typeDef.properties.size > config.maxProperties / 2) {
    return false;
  }

  // Don't flatten if it's referenced by multiple types
  // (This would require counting references, which we'd need to implement)

  return true;
}

/**
 * Calculate nesting level of a type
 */
function calculateNestingLevel(
  graph: Graph,
  node: TypeDefinitionNode,
  visited: Set<NodeId> = new Set()
): number {
  if (visited.has(node.id)) return 0;
  visited.add(node.id);

  let maxDepth = 0;

  if (node.typeDef.properties) {
    for (const propTypeId of node.typeDef.properties.values()) {
      const propType = graph.nodes.get(propTypeId);
      
      if (propType && propType.kind === 'TypeDefinition') {
        const depth = calculateNestingLevel(
          graph, 
          propType as TypeDefinitionNode, 
          visited
        );
        maxDepth = Math.max(maxDepth, depth + 1);
      }
    }
  }

  return maxDepth;
}

/**
 * Find deeply nested types that could benefit from flattening
 */
export function findNestedTypes(
  graph: Graph,
  config: Partial<FlattenConfig> = {}
): NodeId[] {
  const finalConfig = { ...DEFAULT_FLATTEN_CONFIG, ...config };
  const nestedTypes: NodeId[] = [];

  for (const node of graph.nodes.values()) {
    if (node.kind !== 'TypeDefinition') continue;

    const nestingLevel = calculateNestingLevel(graph, node);
    
    if (nestingLevel > finalConfig.maxNestingLevel) {
      nestedTypes.push(node.id);
    }
  }

  return nestedTypes.sort((a, b) => {
    const nodeA = graph.nodes.get(a)!;
    const nodeB = graph.nodes.get(b)!;
    const depthA = calculateNestingLevel(graph, nodeA as TypeDefinitionNode);
    const depthB = calculateNestingLevel(graph, nodeB as TypeDefinitionNode);
    return depthB - depthA; // Descending by depth
  });
}

/**
 * Analyze flattening impact on the graph
 */
export function analyzeFlatteningImpact(
  graph: Graph,
  config: Partial<FlattenConfig> = {}
): {
  nodesAffected: number;
  propertiesFlattened: number;
  avgNestingLevelBefore: number;
  avgNestingLevelAfter: number;
} {
  const finalConfig = { ...DEFAULT_FLATTEN_CONFIG, ...config };
  const typeNodes = Array.from(graph.nodes.values())
    .filter(n => n.kind === 'TypeDefinition') as TypeDefinitionNode[];

  let totalNestingBefore = 0;
  let totalNestingAfter = 0;
  let propertiesFlattened = 0;

  for (const node of typeNodes) {
    totalNestingBefore += calculateNestingLevel(graph, node);
    
    const result = flattenType(graph, { ...node }, finalConfig);
    propertiesFlattened += result.propertiesFlattened;
    
    totalNestingAfter += calculateNestingLevel(graph, node);
  }

  const nodesAffected = typeNodes.length;

  return {
    nodesAffected,
    propertiesFlattened,
    avgNestingLevelBefore: totalNestingBefore / nodesAffected,
    avgNestingLevelAfter: totalNestingAfter / nodesAffected,
  };
}
