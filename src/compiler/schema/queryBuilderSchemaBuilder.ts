/**
 * Schema Builder from Query Builder Analysis
 * Converts QueryBuilderSchema into minimal OpenAPI 3.1 schemas
 */

import type { JsonSchema, SchemaContext } from "./types.js";
import { schemaFromEntity } from "../../metal/schemaFromEntity.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";
import type { QueryBuilderSchema } from "./queryBuilderAnalyzer.js";
import ts from "typescript";

export function buildSchemaFromQueryBuilder(
  querySchema: QueryBuilderSchema,
  entityType: ts.ObjectType,
  ctx: SchemaContext
): JsonSchema | null {
  const baseSchema = schemaFromEntity(entityType as unknown as Function, {
    mode: "read",
    includeRelations: "none"
  });

  if (baseSchema && baseSchema.properties && Object.keys(baseSchema.properties).length > 0) {
    return buildFilteredSchemaFromBase(querySchema, baseSchema);
  }

  const entitySchema = typeToJsonSchema(entityType as ts.Type, ctx);
  
  if (entitySchema.properties && Object.keys(entitySchema.properties).length > 0) {
    return buildFilteredSchemaFromBase(querySchema, entitySchema);
  }

  return {};
}

function buildFilteredSchemaFromBase(
  querySchema: QueryBuilderSchema,
  baseSchema: JsonSchema
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of querySchema.selectedFields) {
    if (baseSchema.properties?.[field]) {
      properties[field] = baseSchema.properties[field];

      if (baseSchema.required && baseSchema.required.includes(field)) {
        required.push(field);
      }
    }
  }

  for (const [relationName, includeSpec] of Object.entries(querySchema.includes)) {
    const relationSchema = handleRelationInclude(
      relationName,
      includeSpec,
      baseSchema,
      {} as SchemaContext
    );

    if (relationSchema) {
      properties[relationName] = relationSchema;

      if (baseSchema.required && baseSchema.required.includes(relationName)) {
        required.push(relationName);
      }
    }
  }

  const schema: JsonSchema = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * Handles a relation include specification
 */
function handleRelationInclude(
  relationName: string,
  includeSpec: QueryBuilderSchema | boolean,
  _baseSchema: JsonSchema,
  _ctx: SchemaContext
): JsonSchema | null {
  if (typeof includeSpec === "boolean") {
    return {
      type: "object",
      properties: {
        id: { type: "integer" }
      },
      required: ["id"]
    };
  } else {
    return {
      type: "object",
      properties: {
        id: { type: "integer" }
      },
      required: ["id"]
    };
  }
}

/**
 * Wraps a schema in PaginatedResult if needed
 */
export function wrapInPaginatedResult(schema: JsonSchema): JsonSchema {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: schema
      },
      page: { type: "integer" },
      pageSize: { type: "integer" },
      totalItems: { type: "integer" }
    },
    required: ["items", "page", "pageSize", "totalItems"]
  };
}