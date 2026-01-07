/**
 * Schema module exports
 */
export { 
  typeToJsonSchema, 
  createSchemaContext 
} from './typeToJsonSchema.js';
export type { JsonSchema, SchemaContext } from './types.js';

// Partitioner exports for modular OpenAPI
export { 
  partitionSchemas, 
  SchemaPartitioner,
  type PartitionStrategy,
  type SchemaGroup,
  type PartitioningResult,
  type SchemaComplexity,
  calculateSchemaComplexity,
} from './partitioner.js';

// Split OpenAPI exports
export { 
  generateModularOpenAPI,
  generateLazyOpenAPI,
  type SplitOpenAPIConfig,
  type SplitOpenAPIResult,
} from './splitOpenapi.js';
