/**
 * Modular OpenAPI Generator
 * Generates split OpenAPI files with $ref pointers to external schema files
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { JsonSchema } from "./types.js";
import type { OpenAPI31 } from "./openapi.js";
import type { PartitioningResult, SchemaGroup } from "./partitioner.js";

/**
 * Progress callback for modular OpenAPI generation
 */
export interface ModularProgressCallback {
  (step: string, index: number, total: number): void;
}

/**
 * Configuration for modular OpenAPI generation
 */
export interface SplitOpenAPIConfig {
  outputDir: string;
  schemasDir?: string;           // Relative to outputDir (default: "schemas")
  createIndexFile?: boolean;     // Create index.json with all refs (default: true)
  prettyPrint?: boolean;         // Pretty print JSON (default: true)
  onProgress?: ModularProgressCallback; // Progress callback
}

/**
 * Result of modular OpenAPI generation
 */
export interface SplitOpenAPIResult {
  mainSpec: string;              // Path to main openapi.json
  schemaFiles: string[];         // Paths to generated schema files
  indexFile?: string;            // Path to index file (if created)
  totalSize: number;             // Total bytes written
  splitEnabled: boolean;         // Whether splitting was applied
}

/**
 * Sanitize schema name for use in filename
 */
function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate a schema file name from group name
 */
function getSchemaFilename(group: SchemaGroup): string {
  const name = sanitizeFilename(group.name);
  return `schemas/${name}.json`;
}

/**
 * Collect all schemas from groups into a single map
 */
function collectAllSchemas(groups: SchemaGroup[]): Map<string, { schema: JsonSchema; group: string }> {
  const result = new Map<string, { schema: JsonSchema; group: string }>();
  
  for (const group of groups) {
    for (const [schemaName, schema] of group.schemas.entries()) {
      result.set(schemaName, { schema, group: group.name });
    }
  }
  
  return result;
}

/**
 * Convert $ref from inline to external reference
 */
function convertToExternalRef(
  schema: JsonSchema,
  schemaMap: Map<string, { schema: JsonSchema; group: string }>
): JsonSchema {
  if (!schema || typeof schema !== 'object') return schema;
  
  const result: Record<string, unknown> = { ...schema };
  
  // Convert $ref to external reference
  if (schema.$ref && typeof schema.$ref === 'string') {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    if (refName && schemaMap.has(refName)) {
      const target = schemaMap.get(refName)!;
      const filename = sanitizeFilename(target.group);
      result.$ref = `schemas/${filename}.json#/components/schemas/${refName}`;
    }
  }
  
  // Recursively process nested schemas
  const nestedProps = ['properties', 'items', 'additionalProperties'];
  for (const prop of nestedProps) {
    if (prop in result) {
      const value = result[prop];
      if (Array.isArray(value)) {
        result[prop] = value.map(item => 
          typeof item === 'object' ? convertToExternalRef(item as JsonSchema, schemaMap) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[prop] = convertToExternalRef(value as JsonSchema, schemaMap);
      }
    }
  }
  
  // Process schema arrays (anyOf, oneOf, allOf)
  const arrayProps = ['anyOf', 'oneOf', 'allOf'];
  for (const prop of arrayProps) {
    if (prop in result && Array.isArray(result[prop])) {
      result[prop] = (result[prop] as unknown[]).map(item =>
        typeof item === 'object' ? convertToExternalRef(item as JsonSchema, schemaMap) : item
      );
    }
  }
  
  return result as JsonSchema;
}

/**
 * Generate individual schema file content
 */
function generateSchemaFileContent(
  group: SchemaGroup,
  schemaMap: Map<string, { schema: JsonSchema; group: string }>
): Record<string, JsonSchema> {
  const content: Record<string, JsonSchema> = {};
  
  for (const [schemaName, schema] of group.schemas.entries()) {
    content[schemaName] = convertToExternalRef(schema, schemaMap);
  }
  
  return content;
}

/**
 * Generate schema index file with all $ref mappings
 */
function generateSchemaIndex(
  groups: SchemaGroup[],
  schemaMap: Map<string, { schema: JsonSchema; group: string }>
): Record<string, Record<string, { $ref: string }>> {
  const index: Record<string, Record<string, { $ref: string }>> = {
    schemas: {},
  };
  
  for (const [schemaName, { group }] of schemaMap.entries()) {
    const filename = sanitizeFilename(group);
    index.schemas![schemaName] = {
      $ref: `schemas/${filename}.json#/components/schemas/${schemaName}`,
    };
  }
  
  return index;
}

/**
 * Generate modular OpenAPI specification with split schema files
 */
export function generateModularOpenAPI(
  openapi: OpenAPI31,
  partitioning: PartitioningResult,
  config: SplitOpenAPIConfig
): SplitOpenAPIResult {
  const {
    outputDir,
    schemasDir = "schemas",
    createIndexFile = true,
    prettyPrint = true,
    onProgress,
  } = config;
  
  const indent = prettyPrint ? 2 : 0;
  let totalSize = 0;
  const schemaFiles: string[] = [];
  
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });
  
  // If not splitting, just write the main file
  if (!partitioning.shouldSplit || partitioning.groups.length === 1) {
    if (onProgress) {
      onProgress("Writing single OpenAPI file", 1, 1);
    }
    const mainPath = resolve(outputDir, "openapi.json");
    writeFileSync(mainPath, JSON.stringify(openapi, null, indent));
    totalSize = Buffer.byteLength(JSON.stringify(openapi));
    
    return {
      mainSpec: mainPath,
      schemaFiles: [],
      totalSize,
      splitEnabled: false,
    };
  }
  
  // Create schemas directory
  const schemasPath = resolve(outputDir, schemasDir);
  mkdirSync(schemasPath, { recursive: true });
  
  if (onProgress) {
    onProgress("Creating schemas directory", 0, partitioning.groups.length + 2);
  }
  
  // Collect all schemas with their groups
  const schemaMap = collectAllSchemas(partitioning.groups);
  
  // Generate individual schema files
  const schemaToFile: Map<string, string> = new Map();
  
  for (let i = 0; i < partitioning.groups.length; i++) {
    const group = partitioning.groups[i];
    if (onProgress) {
      onProgress(`Writing schema group ${group.name} (${group.schemas.size} schemas)`, i + 1, partitioning.groups.length + 2);
    }
    const filename = getSchemaFilename(group);
    const filePath = resolve(outputDir, filename);
    
    const content = generateSchemaFileContent(group, schemaMap);
    writeFileSync(filePath, JSON.stringify(content, null, indent));
    
    for (const schemaName of group.schemas.keys()) {
      schemaToFile.set(schemaName, filename);
    }
    
    schemaFiles.push(filePath);
    totalSize += Buffer.byteLength(JSON.stringify(content));
  }
  
  // Generate index file if requested
  let indexFile: string | undefined;
  if (createIndexFile) {
    if (onProgress) {
      onProgress("Generating index file", partitioning.groups.length + 1, partitioning.groups.length + 2);
    }
    const indexPath = resolve(outputDir, "schemas/index.json");
    const indexContent = generateSchemaIndex(partitioning.groups, schemaMap);
    writeFileSync(indexPath, JSON.stringify(indexContent, null, indent));
    totalSize += Buffer.byteLength(JSON.stringify(indexContent));
    indexFile = indexPath;
  }
  
  // Generate main openapi.json with $ref pointers
  if (onProgress) {
    onProgress("Generating main OpenAPI spec", partitioning.groups.length + 2, partitioning.groups.length + 2);
  }
  const mainSpec = generateMainSpec(openapi, schemaMap, schemaToFile);
  const mainPath = resolve(outputDir, "openapi.json");
  writeFileSync(mainPath, JSON.stringify(mainSpec, null, indent));
  totalSize += Buffer.byteLength(JSON.stringify(mainSpec));
  
  return {
    mainSpec: mainPath,
    schemaFiles,
    indexFile,
    totalSize,
    splitEnabled: true,
  };
}

/**
 * Extended OpenAPI type with x-* properties for split mode
 */
interface ExtendedOpenAPI31 extends OpenAPI31 {
  'x-original-schemas'?: number;
  'x-split-enabled'?: boolean;
  'x-schema-files'?: string[];
}

/**
 * Generate main OpenAPI spec with external $ref pointers
 */
function generateMainSpec(
  original: OpenAPI31,
  schemaMap: Map<string, { schema: JsonSchema; group: string }>,
  schemaToFile: Map<string, string>
): ExtendedOpenAPI31 {
  // Build components.schemas with $ref pointers
  const schemas: Record<string, JsonSchema> = {};
  
  for (const [schemaName, { group }] of schemaMap.entries()) {
    const filename = sanitizeFilename(group);
    schemas[schemaName] = {
      $ref: `schemas/${filename}.json#/components/schemas/${schemaName}`,
    };
  }
  
  // Create new OpenAPI spec with split schemas
  return {
    ...original,
    components: {
      ...original.components,
      schemas,
    },
    'x-original-schemas': Object.keys(schemaMap).length,
    'x-split-enabled': true,
    'x-schema-files': Array.from(new Set(schemaToFile.values())),
  };
}

/**
 * Generate a lightweight OpenAPI spec that references external files
 * This is useful for Swagger UI lazy loading
 */
export function generateLazyOpenAPI(
  openapi: OpenAPI31,
  partitioning: PartitioningResult
): OpenAPI31 {
  if (!partitioning.shouldSplit || partitioning.groups.length === 1) {
    return openapi;
  }
  
  const schemaMap = collectAllSchemas(partitioning.groups);
  
  // Only include minimal info in main spec
  const minimalSchemas: Record<string, JsonSchema> = {};
  
  for (const [schemaName] of schemaMap.entries()) {
    minimalSchemas[schemaName] = {
      $ref: `schemas/${schemaName.toLowerCase()}.json#/components/schemas/${schemaName}`,
    };
  }
  
  return {
    ...openapi,
    components: {
      ...openapi.components,
      schemas: minimalSchemas,
    },
  };
}

/**
 * Get the file path for a schema group
 */
export function getSchemaFilePath(
  groupName: string,
  outputDir: string,
  schemasDir: string = "schemas"
): string {
  const filename = sanitizeFilename(groupName);
  return resolve(outputDir, schemasDir, `${filename}.json`);
}

/**
 * Check if a schema exists in a specific file
 */
export function schemaExistsInFile(
  schemaName: string,
  outputDir: string,
  groupName: string
): boolean {
  const filePath = getSchemaFilePath(groupName, outputDir);
  
  if (!existsSync(filePath)) {
    return false;
  }
  
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    return schemaName in content;
  } catch {
    return false;
  }
}
