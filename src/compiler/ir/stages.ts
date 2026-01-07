/**
 * Compilation stages for IR pipeline.
 * Each stage implements a specific compilation phase.
 */
import type { Graph } from "../graph/types.js";
import type { IRStage } from "./pipeline.js";

/**
 * Stage names
 */
export const STAGE_NAMES = {
  PARSE: 'parse',
  TYPE_RESOLVE: 'type-resolve',
  NORMALIZE: 'normalize',
  OPTIMIZE: 'optimize',
  GENERATE: 'generate',
} as const;

/**
 * Parse stage - builds graph from AST
 */
export const parseStage: IRStage = {
  name: STAGE_NAMES.PARSE,
  description: 'Build graph from AST and CST',
  dependencies: [],
  process(graph: Graph): Graph {
    // Graph is already built at this point
    // This stage validates the graph structure
    return graph;
  },
};

/**
 * Type resolution stage - resolves type references
 */
export const typeResolveStage: IRStage = {
  name: STAGE_NAMES.TYPE_RESOLVE,
  description: 'Resolve type references and add type information',
  dependencies: [STAGE_NAMES.PARSE],
  process(graph: Graph): Graph {
    // Type resolution logic would go here
    // For now, just return the graph as-is
    return graph;
  },
};

/**
 * Normalization stage - normalizes graph structure
 */
export const normalizeStage: IRStage = {
  name: STAGE_NAMES.NORMALIZE,
  description: 'Normalize graph structure and remove inconsistencies',
  dependencies: [STAGE_NAMES.TYPE_RESOLVE],
  process(graph: Graph): Graph {
    // Normalization logic would go here
    // For now, just return the graph as-is
    return graph;
  },
};

/**
 * Optimization stage - applies optimizations
 */
export const optimizeStage: IRStage = {
  name: STAGE_NAMES.OPTIMIZE,
  description: 'Apply graph optimizations',
  dependencies: [STAGE_NAMES.NORMALIZE],
  process(graph: Graph): Graph {
    // Optimizations would go here
    // For now, just return the graph as-is
    return graph;
  },
};

/**
 * Generation stage - generates outputs
 */
export const generateStage: IRStage = {
  name: STAGE_NAMES.GENERATE,
  description: 'Generate OpenAPI, manifest, and validators',
  dependencies: [STAGE_NAMES.OPTIMIZE],
  process(graph: Graph): Graph {
    // Generation logic would go here
    // For now, just return the graph as-is
    return graph;
  },
};

/**
 * Get all default stages
 */
export function getAllStages(): IRStage[] {
  return [
    parseStage,
    typeResolveStage,
    normalizeStage,
    optimizeStage,
    generateStage,
  ];
}

/**
 * Create custom pipeline with selected stages
 */
export function createCustomPipeline(
  stageNames: (typeof STAGE_NAMES)[keyof typeof STAGE_NAMES][]
): IRStage[] {
  const availableStages = new Map(
    getAllStages().map(s => [s.name, s])
  );

  const selectedStages: IRStage[] = [];
  const visited = new Set<string>();

  // Add stages in order with dependencies
  for (const stageName of stageNames) {
    const stage = availableStages.get(stageName);
    if (!stage) {
      throw new Error(`Stage ${stageName} not found`);
    }

    // Add dependencies first
    if (stage.dependencies) {
      for (const dep of stage.dependencies) {
        if (!visited.has(dep)) {
          const depStage = availableStages.get(dep);
          if (depStage) {
            selectedStages.push(depStage);
            visited.add(dep);
          }
        }
      }
    }

    if (!visited.has(stageName)) {
      selectedStages.push(stage);
      visited.add(stageName);
    }
  }

  return selectedStages;
}
