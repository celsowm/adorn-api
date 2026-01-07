/**
 * GEMS Compiler Example
 * Demonstrates the new graph-based compiler architecture
 */
import { GEMS, createGEMSConfig } from './compiler/gems.js';
import { analyzeProject } from './compiler/gems.js';

async function main() {
  console.log('=== GEMS Compiler Example ===\n');

  // Example 1: Quick compile with default settings
  console.log('1. Quick compile with deduplication...');
  try {
    const result = await GEMS.quickCompile('./tsconfig.json');

    console.log(`   ✓ Compilation completed in ${result.duration}ms`);
    console.log(`   ✓ Total nodes: ${result.statistics.totalNodes}`);
    console.log(`   ✓ Duplicates removed: ${result.statistics.duplicatesRemoved}`);
    console.log(`   ✓ Cycles detected: ${result.statistics.cyclesDetected}`);
  } catch (error) {
    console.error(`   ✗ Compilation failed:`, error);
  }

  // Example 2: Compile with custom configuration
  console.log('\n2. Compile with custom configuration...');
  try {
    const config = createGEMSConfig('./tsconfig.json', {
      deduplicate: true,
      inline: true,
      flatten: true,
      verbose: true,
    });

    const result = await GEMS.compile(config);

    console.log(`   ✓ Compilation completed in ${result.duration}ms`);
    console.log(`   ✓ Total nodes: ${result.statistics.totalNodes}`);
    console.log(`   ✓ Total edges: ${result.statistics.totalEdges}`);
    console.log(`   ✓ Duplicates removed: ${result.statistics.duplicatesRemoved}`);
    console.log(`   ✓ Nodes inlined: ${result.statistics.nodesInlined}`);
    console.log(`   ✓ Nodes flattened: ${result.statistics.nodesFlattened}`);
    console.log(`   ✓ Stages executed: ${result.stages.join(', ')}`);
  } catch (error) {
    console.error(`   ✗ Compilation failed:`, error);
  }

  // Example 3: Analyze project without full compilation
  console.log('\n3. Project analysis...');
  try {
    const analysis = await analyzeProject('./tsconfig.json');

    console.log(`   ✓ Type definitions: ${analysis.analysis.typeCount}`);
    console.log(`   ✓ Controllers: ${analysis.analysis.controllerCount}`);
    console.log(`   ✓ Operations: ${analysis.analysis.operationCount}`);
    console.log(`   ✓ Average complexity: ${analysis.analysis.avgComplexity.toFixed(2)}`);
    
    console.log('\n   Potential optimizations:');
    console.log(`   - Duplicate types: ${analysis.analysis.potentialOptimizations.duplicateTypes}`);
    console.log(`   - Inline candidates: ${analysis.analysis.potentialOptimizations.inlineCandidates}`);
    console.log(`   - Flatten candidates: ${analysis.analysis.potentialOptimizations.flattenCandidates}`);
  } catch (error) {
    console.error(`   ✗ Analysis failed:`, error);
  }

  // Example 4: Access schema graph for advanced operations
  console.log('\n4. Schema graph operations...');
  try {
    const config = createGEMSConfig('./tsconfig.json', {
      verbose: false,
    });

    const result = await GEMS.compile(config);
    const schemaGraph = result.schemaGraph;

    // Find strongly connected components
    const sccs = schemaGraph.findStronglyConnectedComponents();
    console.log(`   ✓ Strongly connected components: ${sccs.length}`);

    // Topological sort
    const sorted = schemaGraph.topologicalSort();
    console.log(`   ✓ Topological sort: ${sorted.length} nodes ordered`);

    // Detect cycles
    const cycleReport = schemaGraph.detectCycles();
    if (cycleReport.hasCycles) {
      console.log(`   ⚠ Cycles detected: ${cycleReport.cycleCount}`);
      cycleReport.cycles.forEach((cycle, i) => {
        console.log(`     Cycle ${i + 1}: ${cycle.join(' -> ')}`);
      });
    } else {
      console.log('   ✓ No cycles detected');
    }

    // Find type usages
    const typeNodes = Array.from(result.graph.nodes.values())
      .filter(n => n.kind === 'TypeDefinition');

    if (typeNodes.length > 0) {
      const firstType = typeNodes[0];
      const usages = schemaGraph.findTypeUsages(firstType.id);
      console.log(`   ✓ Type "${firstType.metadata.name}" used in ${usages.length} places`);
    }
  } catch (error) {
    console.error(`   ✗ Graph operations failed:`, error);
  }

  console.log('\n=== Example Complete ===');
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
