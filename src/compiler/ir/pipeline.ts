/**
 * IR Pipeline orchestrator for multi-stage graph transformation.
 * Manages compilation stages with dependency resolution.
 */
import type { Graph } from "../graph/types.js";

/**
 * Transformation stage in the IR pipeline
 */
export interface IRStage {
  name: string;
  process(graph: Graph): Promise<Graph> | Graph;
  dependencies?: string[];
  description?: string;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  graph: Graph;
  stagesExecuted: string[];
  duration: number;
  errors: Error[];
}

/**
 * IR Pipeline for multi-stage compilation
 */
export class IRPipeline {
  private stages: Map<string, IRStage> = new Map();
  private executionHistory: string[] = [];

  /**
   * Register a transformation stage
   */
  addStage(stage: IRStage): void {
    this.stages.set(stage.name, stage);
  }

  /**
   * Remove a stage from the pipeline
   */
  removeStage(stageName: string): void {
    this.stages.delete(stageName);
  }

  /**
   * Get a stage by name
   */
  getStage(stageName: string): IRStage | undefined {
    return this.stages.get(stageName);
  }

  /**
   * Get all registered stages
   */
  getAllStages(): IRStage[] {
    return Array.from(this.stages.values());
  }

  /**
   * Execute the entire pipeline
   */
  async execute(initialGraph: Graph): Promise<PipelineResult> {
    const startTime = Date.now();
    let currentGraph = initialGraph;
    const errors: Error[] = [];
    this.executionHistory = [];

    try {
      const executionOrder = this.resolveExecutionOrder();

      for (const stageName of executionOrder) {
        const stage = this.stages.get(stageName);
        if (!stage) {
          throw new Error(`Stage ${stageName} not found`);
        }

        this.executionHistory.push(stageName);

        try {
          const startStage = Date.now();
          currentGraph = await stage.process(currentGraph);
          const duration = Date.now() - startStage;

          // Log stage completion (could be replaced with proper logger)
          console.log(`[Pipeline] ${stage.name} completed in ${duration}ms`);
        } catch (error) {
          if (error instanceof Error) {
            errors.push(error);
          } else {
            errors.push(new Error(String(error)));
          }
          console.error(`[Pipeline] Stage ${stage.name} failed:`, error);
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error);
      }
    }

    const duration = Date.now() - startTime;

    return {
      graph: currentGraph,
      stagesExecuted: this.executionHistory,
      duration,
      errors,
    };
  }

  /**
   * Execute only specific stages
   */
  async executeFrom(
    initialGraph: Graph,
    fromStage: string
  ): Promise<PipelineResult> {
    const order = this.resolveExecutionOrder();
    const startIndex = order.indexOf(fromStage);

    if (startIndex === -1) {
      throw new Error(`Stage ${fromStage} not found`);
    }

    const stagesToRun = order.slice(startIndex);

    // Create temporary pipeline with only these stages
    const tempPipeline = new IRPipeline();
    for (const stageName of stagesToRun) {
      const stage = this.stages.get(stageName);
      if (stage) {
        tempPipeline.addStage(stage);
      }
    }

    return tempPipeline.execute(initialGraph);
  }

  /**
   * Execute only up to a specific stage
   */
  async executeTo(
    initialGraph: Graph,
    toStage: string
  ): Promise<PipelineResult> {
    const order = this.resolveExecutionOrder();
    const endIndex = order.indexOf(toStage) + 1;

    if (endIndex === 0) {
      throw new Error(`Stage ${toStage} not found`);
    }

    const stagesToRun = order.slice(0, endIndex);

    // Create temporary pipeline with only these stages
    const tempPipeline = new IRPipeline();
    for (const stageName of stagesToRun) {
      const stage = this.stages.get(stageName);
      if (stage) {
        tempPipeline.addStage(stage);
      }
    }

    return tempPipeline.execute(initialGraph);
  }

  /**
   * Resolve execution order based on dependencies
   */
  private resolveExecutionOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (stageName: string): void => {
      if (visited.has(stageName)) return;
      if (visiting.has(stageName)) {
        throw new Error(`Circular dependency detected involving ${stageName}`);
      }

      visiting.add(stageName);

      const stage = this.stages.get(stageName);
      if (!stage) {
        throw new Error(`Stage ${stageName} not found`);
      }

      // Visit dependencies first
      if (stage.dependencies) {
        for (const dep of stage.dependencies) {
          if (!this.stages.has(dep)) {
            throw new Error(`Dependency ${dep} not found for stage ${stageName}`);
          }
          visit(dep);
        }
      }

      visiting.delete(stageName);
      visited.add(stageName);
      order.push(stageName);
    };

    for (const stageName of this.stages.keys()) {
      visit(stageName);
    }

    return order;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): string[] {
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Validate pipeline configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for circular dependencies
    try {
      this.resolveExecutionOrder();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    // Check that all dependencies exist
    for (const [name, stage] of this.stages.entries()) {
      if (stage.dependencies) {
        for (const dep of stage.dependencies) {
          if (!this.stages.has(dep)) {
            errors.push(`Stage ${name} depends on non-existent stage ${dep}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Create a default pipeline with standard stages
 */
export function createDefaultPipeline(): IRPipeline {
  const pipeline = new IRPipeline();
  
  // Stages will be added separately
  // Parse -> TypeResolve -> Normalize -> Optimize -> Generate
  
  return pipeline;
}
