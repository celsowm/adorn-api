/**
 * Smart OpenAPI Schema Partitioner
 * Automatically partitions schemas into optimal groups based on heuristics
 */
import type { Graph, NodeId } from "../graph/types.js";
import type { SchemaGraph } from "../graph/schemaGraph.js";
import type { JsonSchema } from "./types.js";

/**
 * Partitioning strategy options
 */
export type PartitionStrategy = 
  | 'auto'        // Smart auto-detection (default)
  | 'none'        // Single file
  | 'controller'  // Group by controller domain
  | 'dependency'  // Group by dependency graph
  | 'size';       // Group by size threshold

/**
 * Schema complexity metrics
 */
export interface SchemaComplexity {
  propertyCount: number;
  nestedDepth: number;
  refCount: number;
  hasUnion: boolean;
  hasIntersection: boolean;
  hasEnum: boolean;
  jsonSize: number;
}

/**
 * A group of schemas for partitioning
 */
export interface SchemaGroup {
  name: string;
  schemas: Map<string, JsonSchema>;
  complexity: number;
  dependencies: string[];
}

/**
 * Partitioning result with metadata
 */
export interface PartitioningResult {
  shouldSplit: boolean;
  strategy: PartitionStrategy;
  groups: SchemaGroup[];
  recommendation: string;
  metrics: {
    totalSchemas: number;
    averageComplexity: number;
    avgDependencyDensity: number;
    controllerGroups: number;
  };
}

/**
 * Configuration for partitioning
 */
export interface PartitionerConfig {
  strategy?: PartitionStrategy;
  threshold?: number;           // Min schemas to trigger split (default: 50)
  maxGroupSize?: number;        // Max schemas per group (default: 50)
  complexityThreshold?: number; // High complexity threshold
  verbose?: boolean;
}

/**
 * Default partitioner configuration
 */
const DEFAULT_CONFIG: Required<PartitionerConfig> = {
  strategy: 'auto',
  threshold: 50,
  maxGroupSize: 50,
  complexityThreshold: 10,
  verbose: false,
};

/**
 * Calculate complexity metrics for a schema
 */
export function calculateSchemaComplexity(schema: JsonSchema): SchemaComplexity {
  let propertyCount = 0;
  let nestedDepth = 0;
  let refCount = 0;
  let hasUnion = false;
  let hasIntersection = false;
  let hasEnum = false;
  
  const jsonSize = JSON.stringify(schema).length;
  
  const analyze = (s: JsonSchema, depth: number): void => {
    if (!s || typeof s !== 'object') return;
    
    nestedDepth = Math.max(nestedDepth, depth);
    
    if (s.type === 'object' && s.properties) {
      propertyCount += Object.keys(s.properties).length;
      for (const prop of Object.values(s.properties)) {
        analyze(prop as JsonSchema, depth + 1);
      }
    }
    
    if (s.$ref) refCount++;
    
    if (s.anyOf || s.oneOf) hasUnion = true;
    if (s.allOf) hasIntersection = true;
    if (s.enum) hasEnum = true;
    
    if (s.items) {
      analyze(s.items as JsonSchema, depth + 1);
    }
  };
  
  analyze(schema, 0);
  
  // Calculate complexity score
  const complexity = 
    propertyCount * 1 +
    nestedDepth * 2 +
    refCount * 0.5 +
    (hasUnion ? 5 : 0) +
    (hasIntersection ? 5 : 0) +
    (hasEnum ? 1 : 0);
  
  return {
    propertyCount,
    nestedDepth,
    refCount,
    hasUnion,
    hasIntersection,
    hasEnum,
    jsonSize,
  };
}

/**
 * Count external $ref references in a schema
 */
function countExternalRefs(
  schema: JsonSchema,
  allSchemas: Map<string, JsonSchema>
): number {
  let count = 0;
  
  const analyze = (s: JsonSchema): void => {
    if (!s || typeof s !== 'object') return;
    
    if (s.$ref && typeof s.$ref === 'string') {
      const refName = s.$ref.replace('#/components/schemas/', '');
      if (refName && allSchemas.has(refName)) {
        count++;
      }
    }
    
    if (s.properties) {
      for (const prop of Object.values(s.properties)) {
        analyze(prop as JsonSchema);
      }
    }
    
    if (s.items) analyze(s.items as JsonSchema);
    if (s.anyOf) s.anyOf.forEach(analyze);
    if (s.oneOf) s.oneOf.forEach(analyze);
    if (s.allOf) s.allOf.forEach(analyze);
  };
  
  analyze(schema);
  return count;
}

/**
 * Analyze dependency density across all schemas
 */
function analyzeDependencyDensity(
  schemas: Map<string, JsonSchema>
): { avgDeps: number; maxDeps: number } {
  let totalDeps = 0;
  let maxDeps = 0;
  
  for (const schema of schemas.values()) {
    const deps = countExternalRefs(schema, schemas);
    totalDeps += deps;
    maxDeps = Math.max(maxDeps, deps);
  }
  
  return {
    avgDeps: schemas.size > 0 ? totalDeps / schemas.size : 0,
    maxDeps,
  };
}

/**
 * Partition schemas by controller domain
 */
function partitionByController(
  schemas: Map<string, JsonSchema>,
  graph: Graph,
  config: Required<PartitionerConfig>
): SchemaGroup[] {
  const groups: Map<string, Map<string, JsonSchema>> = new Map();
  const sharedSchemas: Map<string, JsonSchema> = new Map();
  
  // Default group for schemas not owned by any controller
  groups.set('_shared', sharedSchemas);
  
  // Analyze schema ownership by tracking usage in operations
  const schemaUsage: Map<string, Set<string>> = new Map();
  
  for (const [nodeId, node] of graph.nodes.entries()) {
    if (node.kind === 'Operation') {
      const opNode = node as any;
      const returnType = opNode.operation?.returnType;
      
      if (returnType && schemas.has(returnType)) {
        if (!schemaUsage.has(returnType)) {
          schemaUsage.set(returnType, new Set());
        }
        schemaUsage.get(returnType)!.add(node.metadata.name);
      }
    }
  }
  
  // Group schemas by primary controller usage
  for (const [schemaName, schema] of schemas.entries()) {
    const usage = schemaUsage.get(schemaName);
    
    if (!usage || usage.size === 0) {
      // No usage info, put in shared
      sharedSchemas.set(schemaName, schema);
    } else if (usage.size === 1) {
      // Used by exactly one controller, group by that controller
      const controllerName = Array.from(usage)[0].split(':')[0] || 'default';
      const groupName = controllerName.toLowerCase();
      
      if (!groups.has(groupName)) {
        groups.set(groupName, new Map());
      }
      groups.get(groupName)!.set(schemaName, schema);
    } else {
      // Used by multiple controllers, put in shared
      sharedSchemas.set(schemaName, schema);
    }
  }
  
  // Convert to SchemaGroup array
  return Array.from(groups.entries()).map(([name, schemaMap]) => {
    let totalComplexity = 0;
    const dependencies: string[] = [];
    
    for (const [schemaName, schema] of schemaMap.entries()) {
      totalComplexity += calculateSchemaComplexity(schema).propertyCount;
      
      const deps = countExternalRefs(schema, schemas);
      for (let i = 0; i < deps; i++) {
        dependencies.push(schemaName);
      }
    }
    
    return {
      name,
      schemas: schemaMap,
      complexity: totalComplexity,
      dependencies,
    };
  });
}

/**
 * Partition schemas by dependency graph
 */
function partitionByDependency(
  schemas: Map<string, JsonSchema>,
  schemaGraph: SchemaGraph,
  config: Required<PartitionerConfig>
): SchemaGroup[] {
  const groups: Map<string, Map<string, JsonSchema>> = new Map();
  
  // Find strongly connected components (circular dependencies)
  const sccs = schemaGraph.findStronglyConnectedComponents();
  
  // Group SCCs together, then add dependent nodes
  const processed = new Set<string>();
  
  for (const scc of sccs) {
    if (scc.length === 1 && processed.has(scc[0])) continue;
    
    const groupSchemas: Map<string, JsonSchema> = new Map();
    const groupName = `dependent-${groups.size + 1}`;
    
    for (const nodeId of scc) {
      const node = schemaGraph.getGraph().nodes.get(nodeId);
      if (node && node.kind === 'TypeDefinition') {
        const schemaName = node.metadata.name;
        if (schemas.has(schemaName)) {
          groupSchemas.set(schemaName, schemas.get(schemaName)!);
          processed.add(nodeId);
        }
      }
    }
    
    if (groupSchemas.size > 0) {
      groups.set(groupName, groupSchemas);
    }
  }
  
  // Handle remaining unprocessed schemas
  for (const [nodeId, node] of schemaGraph.getGraph().nodes.entries()) {
    if (processed.has(nodeId)) continue;
    if (node.kind !== 'TypeDefinition') continue;
    
    const schemaName = node.metadata.name;
    if (!schemas.has(schemaName)) continue;
    
    const groupSchemas: Map<string, JsonSchema> = new Map();
    groupSchemas.set(schemaName, schemas.get(schemaName)!);
    
    groups.set(`standalone-${groups.size + 1}`, groupSchemas);
    processed.add(nodeId);
  }
  
  // Convert to SchemaGroup array
  return Array.from(groups.entries()).map(([name, schemaMap]) => {
    let totalComplexity = 0;
    const dependencies: string[] = [];
    
    for (const [schemaName, schema] of schemaMap.entries()) {
      totalComplexity += calculateSchemaComplexity(schema).propertyCount;
      const deps = countExternalRefs(schema, schemas);
      for (let i = 0; i < deps; i++) {
        dependencies.push(schemaName);
      }
    }
    
    return {
      name,
      schemas: schemaMap,
      complexity: totalComplexity,
      dependencies,
    };
  });
}

/**
 * Partition schemas by size threshold
 */
function partitionBySize(
  schemas: Map<string, JsonSchema>,
  config: Required<PartitionerConfig>
): SchemaGroup[] {
  const sortedSchemas = Array.from(schemas.entries()).sort((a, b) => {
    const complexityA = calculateSchemaComplexity(a[1]).propertyCount;
    const complexityB = calculateSchemaComplexity(b[1]).propertyCount;
    return complexityB - complexityA; // Sort by complexity descending
  });
  
  const groups: Map<string, Map<string, JsonSchema>> = new Map();
  let currentGroup: Map<string, JsonSchema> = new Map();
  let currentCount = 0;
  let groupIndex = 1;
  
  for (const [schemaName, schema] of sortedSchemas) {
    if (currentCount >= config.maxGroupSize) {
      groups.set(`group-${groupIndex}`, currentGroup);
      currentGroup = new Map();
      currentCount = 0;
      groupIndex++;
    }
    
    currentGroup.set(schemaName, schema);
    currentCount++;
  }
  
  // Add remaining schemas
  if (currentCount > 0) {
    groups.set(`group-${groupIndex}`, currentGroup);
  }
  
  // Convert to SchemaGroup array
  return Array.from(groups.entries()).map(([name, schemaMap]) => {
    let totalComplexity = 0;
    const dependencies: string[] = [];
    
    for (const [schemaName, schema] of schemaMap.entries()) {
      totalComplexity += calculateSchemaComplexity(schema).propertyCount;
      const deps = countExternalRefs(schema, schemas);
      for (let i = 0; i < deps; i++) {
        dependencies.push(schemaName);
      }
    }
    
    return {
      name,
      schemas: schemaMap,
      complexity: totalComplexity,
      dependencies,
    };
  });
}

/**
 * Determine best strategy using smart heuristics
 */
function determineBestStrategy(
  schemas: Map<string, JsonSchema>,
  graph: Graph,
  schemaGraph: SchemaGraph,
  config: Required<PartitionerConfig>
): PartitionStrategy {
  const schemaCount = schemas.size;
  const { avgDeps } = analyzeDependencyDensity(schemas);
  
  // Count controller groups
  let controllerGroups = 0;
  for (const node of graph.nodes.values()) {
    if (node.kind === 'Controller') {
      controllerGroups++;
    }
  }
  
  // Heuristic decision tree
  if (schemaCount < config.threshold) {
    return 'none';
  }
  
  if (avgDeps > 3) {
    // High inter-dependency → dependency-based
    return 'dependency';
  }
  
  if (controllerGroups > 1 && avgDeps < 2) {
    // Clear controller ownership with low coupling → controller-based
    return 'controller';
  }
  
  // Default to size-based
  return 'size';
}

/**
 * Main partitioning function with smart auto-detection
 */
export function partitionSchemas(
  schemas: Map<string, JsonSchema>,
  graph: Graph,
  schemaGraph: SchemaGraph,
  config: PartitionerConfig = {}
): PartitioningResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const schemaCount = schemas.size;
  
  // Calculate metrics
  let totalComplexity = 0;
  let totalSchemas = 0;
  const { avgDeps } = analyzeDependencyDensity(schemas);
  
  let controllerGroups = 0;
  for (const node of graph.nodes.values()) {
    if (node.kind === 'Controller') {
      controllerGroups++;
    }
  }
  
  for (const schema of schemas.values()) {
    totalComplexity += calculateSchemaComplexity(schema).propertyCount;
    totalSchemas++;
  }
  
  const avgComplexity = totalSchemas > 0 ? totalComplexity / totalSchemas : 0;
  
  // Determine strategy
  let strategy = finalConfig.strategy;
  let recommendation = '';
  
  if (strategy === 'auto') {
    strategy = determineBestStrategy(schemas, graph, schemaGraph, finalConfig);
    
    // Generate recommendation message
    if (schemaCount < finalConfig.threshold) {
      recommendation = `Schema count (${schemaCount}) below threshold (${finalConfig.threshold}), single file optimal`;
    } else if (strategy === 'dependency') {
      recommendation = `High dependency density (${avgDeps.toFixed(2)} avg refs/schema), using dependency-based partitioning`;
    } else if (strategy === 'controller') {
      recommendation = `Found ${controllerGroups} controller groups with low coupling, using controller-based partitioning`;
    } else {
      recommendation = `Using size-based partitioning with max ${finalConfig.maxGroupSize} schemas per group`;
    }
  }
  
  // Perform partitioning based on strategy
  let groups: SchemaGroup[] = [];
  
  if (strategy === 'none') {
    groups = [{
      name: 'all',
      schemas: new Map(schemas),
      complexity: totalComplexity,
      dependencies: [],
    }];
    recommendation = recommendation || 'Single file mode (--split not specified)';
  } else if (strategy === 'controller') {
    groups = partitionByController(schemas, graph, finalConfig);
  } else if (strategy === 'dependency') {
    groups = partitionByDependency(schemas, schemaGraph, finalConfig);
  } else {
    groups = partitionBySize(schemas, finalConfig);
  }
  
  // Determine if we should actually split
  const shouldSplit = strategy !== 'none' && schemaCount >= finalConfig.threshold;
  
  return {
    shouldSplit,
    strategy,
    groups,
    recommendation,
    metrics: {
      totalSchemas: schemaCount,
      averageComplexity: avgComplexity,
      avgDependencyDensity: avgDeps,
      controllerGroups,
    },
  };
}

/**
 * Export partitioner class for advanced use cases
 */
export class SchemaPartitioner {
  private config: Required<PartitionerConfig>;
  
  constructor(config: PartitionerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Partition schemas with the configured strategy
   */
  partition(
    schemas: Map<string, JsonSchema>,
    graph: Graph,
    schemaGraph: SchemaGraph
  ): PartitioningResult {
    return partitionSchemas(schemas, graph, schemaGraph, this.config);
  }
  
  /**
   * Set the partitioning strategy
   */
  setStrategy(strategy: PartitionStrategy): void {
    this.config.strategy = strategy;
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<PartitionerConfig>> {
    return this.config;
  }
}
