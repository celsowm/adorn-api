/**
 * GEMS Compiler - Fully Integrated Version
 * Complete integration with generators
 */
import ts from "typescript";
import { createProgramFromConfig } from "./runner/createProgram.js";
import { createGraphBuilderContext, buildGraph } from "./graph/builder.js";
import { SchemaGraph } from "./graph/schemaGraph.js";
import { applyDeduplication } from "./transform/dedup.js";
import { applyInlining, findInlineCandidates } from "./transform/inline.js";
import { applyFlattening, analyzeFlatteningImpact } from "./transform/flatten.js";
import { generateOpenAPIFromGraph } from "./generator/openapi.js";
import { generateManifestFromGraph } from "./generator/manifest.js";
import type { Graph } from "./graph/types.js";

/**
 * GEMS Compiler configuration
 */
export interface GEMSConfig {
  tsconfigPath: string;
  deduplicate: boolean;
  inline: boolean;
  flatten: boolean;
  verbose: boolean;
  generateOpenAPI: boolean;
  generateManifest: boolean;
  outputPath?: string;
}

/**
 * GEMS Compiler result
 */
export interface GEMSResult {
  graph: Graph;
  schemaGraph: SchemaGraph;
  openapi?: any;
  manifest?: any;
  stages: string[];
  duration: number;
  statistics: {
    totalNodes: number;
    totalEdges: number;
    cyclesDetected: number;
    stronglyConnectedComponents: number;
    duplicatesRemoved: number;
    nodesInlined: number;
    nodesFlattened: number;
  };
}

/**
 * Create default GEMS compiler configuration
 */
export function createGEMSConfig(
  tsconfigPath: string,
  partial: Partial<GEMSConfig> = {}
): GEMSConfig {
  return {
    tsconfigPath,
    deduplicate: true,
    inline: false,
    flatten: false,
    verbose: false,
    generateOpenAPI: true,
    generateManifest: true,
    outputPath: './.adorn',
    ...partial,
  };
}

/**
 * Compile TypeScript sources using GEMS compiler
 */
export async function compileWithGEMS(config: GEMSConfig): Promise<GEMSResult> {
  const startTime = Date.now();

  // Step 1: Create TypeScript program
  if (config.verbose) {
    console.log('[GEMS] Creating TypeScript program...');
  }
  const programContext = createProgramFromConfig(config.tsconfigPath);

  // Step 2: Build initial graph from AST
  if (config.verbose) {
    console.log('[GEMS] Building graph from AST...');
  }
  const graphBuilderContext = createGraphBuilderContext(
    programContext.checker,
    programContext.sourceFiles,
    ts.version
  );
  let graph = buildGraph(graphBuilderContext);

  // Step 3: Create schema graph wrapper
  const schemaGraph = new SchemaGraph(graph);

  // Track statistics
  const statistics = {
    totalNodes: graph.nodes.size,
    totalEdges: 0,
    cyclesDetected: 0,
    stronglyConnectedComponents: 0,
    duplicatesRemoved: 0,
    nodesInlined: 0,
    nodesFlattened: 0,
  };

  // Count edges
  for (const node of graph.nodes.values()) {
    statistics.totalEdges += node.edges.length;
  }

  // Detect cycles
  const cycleReport = schemaGraph.detectCycles();
  statistics.cyclesDetected = cycleReport.cycleCount;

  if (config.verbose && cycleReport.hasCycles) {
    console.warn(`[GEMS] Detected ${cycleReport.cycleCount} cycles in dependency graph`);
  }

  // Find strongly connected components
  const sccs = schemaGraph.findStronglyConnectedComponents();
  statistics.stronglyConnectedComponents = sccs.length;

  if (config.verbose && sccs.length > 0) {
    console.log(`[GEMS] Found ${sccs.length} strongly connected components`);
  }

  // Apply deduplication
  if (config.deduplicate) {
    if (config.verbose) {
      console.log('[GEMS] Applying deduplication...');
    }
    const dedupResult = applyDeduplication(graph);
    statistics.duplicatesRemoved = dedupResult.removedCount;

    if (config.verbose) {
      console.log(`[GEMS] Removed ${dedupResult.removedCount} duplicate type definitions`);
    }
  }

  // Apply inlining
  if (config.inline) {
    if (config.verbose) {
      console.log('[GEMS] Applying inlining...');
    }
    const inlineResult = applyInlining(graph);
    statistics.nodesInlined = inlineResult.nodesRemoved;

    if (config.verbose) {
      console.log(`[GEMS] Inlined ${inlineResult.nodesRemoved} type definitions`);
    }
  }

  // Apply flattening
  if (config.flatten) {
    if (config.verbose) {
      console.log('[GEMS] Applying flattening...');
    }
    const flattenResult = applyFlattening(graph);
    statistics.nodesFlattened = flattenResult.flattenedNodes.length;

    if (config.verbose) {
      console.log(`[GEMS] Flattened ${flattenResult.flattenedNodes.length} type definitions`);
    }
  }

  // Generate OpenAPI
  let openapi: any = undefined;
  if (config.generateOpenAPI) {
    if (config.verbose) {
      console.log('[GEMS] Generating OpenAPI specification...');
    }
    openapi = generateOpenAPIFromGraph(graph, schemaGraph);

    if (config.verbose) {
      console.log(`[GEMS] Generated OpenAPI with ${Object.keys(openapi.paths).length} paths`);
    }
  }

  // Generate manifest
  let manifest: any = undefined;
  if (config.generateManifest) {
    if (config.verbose) {
      console.log('[GEMS] Generating manifest...');
    }
    manifest = generateManifestFromGraph(graph, {
      validationMode: 'ajv-runtime',
      version: '1.0.0',
      typescriptVersion: ts.version,
    });

    if (config.verbose) {
      console.log(`[GEMS] Generated manifest with ${manifest.controllers.length} controllers`);
    }
  }

  const duration = Date.now() - startTime;

  if (config.verbose) {
    console.log('[GEMS] Compilation completed');
    console.log(`[GEMS] Duration: ${duration}ms`);
    console.log(`[GEMS] Final statistics:`, statistics);
  }

  return {
    graph,
    schemaGraph,
    openapi,
    manifest,
    stages: ['parse', 'build', 'transform', 'generate'],
    duration,
    statistics,
  };
}

/**
 * Quick compile with default configuration
 */
export async function quickCompile(tsconfigPath: string): Promise<GEMSResult> {
  const config = createGEMSConfig(tsconfigPath, {
    verbose: false,
    deduplicate: true,
  });

  return compileWithGEMS(config);
}

/**
 * Analyze a TypeScript project without full compilation
 */
export async function analyzeProject(
  tsconfigPath: string
): Promise<{
  graph: Graph;
  schemaGraph: SchemaGraph;
  analysis: {
    typeCount: number;
    controllerCount: number;
    operationCount: number;
    avgComplexity: number;
    potentialOptimizations: {
      duplicateTypes: number;
      inlineCandidates: number;
      flattenCandidates: number;
    };
  };
}> {
  const programContext = createProgramFromConfig(tsconfigPath);
  const graphBuilderContext = createGraphBuilderContext(
    programContext.checker,
    programContext.sourceFiles,
    ts.version
  );
  const graph = buildGraph(graphBuilderContext);
  const schemaGraph = new SchemaGraph(graph);

  // Analyze graph
  let typeCount = 0;
  let controllerCount = 0;
  let operationCount = 0;
  let totalComplexity = 0;

  for (const node of graph.nodes.values()) {
    if (node.kind === 'TypeDefinition') {
      typeCount++;
    } else if (node.kind === 'Controller') {
      controllerCount++;
    } else if (node.kind === 'Operation') {
      operationCount++;
    }
  }

  // Find optimization opportunities
  const duplicateTypes = applyDeduplication(graph);
  const inlineCandidates = findInlineCandidates(graph);
  const flattenCandidates = analyzeFlatteningImpact(graph);

  return {
    graph,
    schemaGraph,
    analysis: {
      typeCount,
      controllerCount,
      operationCount,
      avgComplexity: typeCount > 0 ? totalComplexity / typeCount : 0,
      potentialOptimizations: {
        duplicateTypes: duplicateTypes.duplicatesFound,
        inlineCandidates: inlineCandidates.length,
        flattenCandidates: flattenCandidates.propertiesFlattened,
      },
    },
  };
}

/**
 * Export GEMS compiler
 */
export const GEMS = {
  compile: compileWithGEMS,
  quickCompile,
  analyze: analyzeProject,
  createConfig: createGEMSConfig,
};
