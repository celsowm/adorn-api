/**
 * Simple GEMS Compiler Example
 * Demonstrates the new graph-based compiler
 */
import { GEMS, createGEMSConfig } from 'adorn-api/compiler/gems';

async function main() {
  console.log('=== GEMS Compiler Demo ===\n');

  const tsconfigPath = './test/fixtures/users/tsconfig.json';

  // Example 1: Quick compile with deduplication
  console.log('1. Quick compile with automatic optimizations...');
  try {
    const result = await GEMS.quickCompile(tsconfigPath);

    console.log(`   ✓ Completed in ${result.duration}ms`);
    console.log(`   ✓ Total nodes: ${result.statistics.totalNodes}`);
    console.log(`   ✓ Total edges: ${result.statistics.totalEdges}`);
    console.log(`   ✓ Duplicates removed: ${result.statistics.duplicatesRemoved}`);
    
    if (result.openapi) {
      const pathCount = Object.keys(result.openapi.paths).length;
      console.log(`   ✓ OpenAPI paths: ${pathCount}`);
    }
    
    if (result.manifest) {
      const controllerCount = result.manifest.controllers.length;
      console.log(`   ✓ Controllers: ${controllerCount}`);
    }
  } catch (error) {
    console.error('   ✗ Failed:', error);
  }

  // Example 2: Compile with all optimizations
  console.log('\n2. Compile with all optimizations enabled...');
  try {
    const config = createGEMSConfig(tsconfigPath, {
      deduplicate: true,
      inline: true,
      flatten: true,
      verbose: true,
      generateOpenAPI: true,
      generateManifest: true,
    });

    const result = await GEMS.compile(config);

    console.log(`   ✓ Completed in ${result.duration}ms`);
    console.log(`   ✓ Optimizations applied:`);
    console.log(`     - Deduplication: ${result.statistics.duplicatesRemoved} nodes`);
    console.log(`     - Inlining: ${result.statistics.nodesInlined} nodes`);
    console.log(`     - Flattening: ${result.statistics.nodesFlattened} nodes`);
  } catch (error) {
    console.error('   ✗ Failed:', error);
  }

  // Example 3: Analyze project without compilation
  console.log('\n3. Project analysis...');
  try {
    const analysis = await GEMS.analyze(tsconfigPath);

    console.log(`   ✓ Type definitions: ${analysis.analysis.typeCount}`);
    console.log(`   ✓ Controllers: ${analysis.analysis.controllerCount}`);
    console.log(`   ✓ Operations: ${analysis.analysis.operationCount}`);
    
    console.log('\n   Potential optimizations:');
    console.log(`     - Duplicate types: ${analysis.analysis.potentialOptimizations.duplicateTypes}`);
    console.log(`     - Inline candidates: ${analysis.analysis.potentialOptimizations.inlineCandidates}`);
    console.log(`     - Flatten candidates: ${analysis.analysis.potentialOptimizations.flattenCandidates}`);
  } catch (error) {
    console.error('   ✗ Failed:', error);
  }

  // Example 4: Schema graph operations
  console.log('\n4. Schema graph analysis...');
  try {
    const config = createGEMSConfig(tsconfigPath);
    const result = await GEMS.compile(config);
    const schemaGraph = result.schemaGraph;

    // Detect cycles
    const cycleReport = schemaGraph.detectCycles();
    console.log(`   ✓ Cycles detected: ${cycleReport.cycleCount}`);

    if (cycleReport.hasCycles && cycleReport.cycles.length > 0) {
      console.log('   ⚠  Warning: Circular dependencies found:');
      cycleReport.cycles.slice(0, 3).forEach((cycle, i) => {
        console.log(`     ${i + 1}. ${cycle.slice(0, 5).join(' -> ')}`);
      });
    }

    // Get topological order
    const sorted = schemaGraph.topologicalSort();
    console.log(`   ✓ Topological order: ${sorted.length} nodes`);

    // Find strongly connected components
    const sccs = schemaGraph.findStronglyConnectedComponents();
    console.log(`   ✓ Strongly connected components: ${sccs.length}`);

    // Find type usages
    const typeNodes = Array.from(result.graph.nodes.values())
      .filter(n => n.kind === 'TypeDefinition');

    if (typeNodes.length > 0) {
      const firstType = typeNodes[0];
      const usages = schemaGraph.findTypeUsages(firstType.id);
      console.log(`   ✓ Type "${firstType.metadata.name}" used in ${usages.length} places`);
    }
  } catch (error) {
    console.error('   ✗ Failed:', error);
  }

  console.log('\n=== Demo Complete ===');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };
