import type { JsonPrimitive, SchemaNode, SchemaSource } from "./schema";
import type { DtoConstructor } from "./types";
import { getDtoMeta } from "./metadata";

/**
 * JSON Schema type.
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Context for building schemas.
 */
export interface SchemaBuildContext {
  /** Schema components */
  components: Record<string, JsonSchema>;
  /** Set of seen DTOs to avoid circular references */
  seen: Set<DtoConstructor>;
}

/**
 * Creates a new schema building context.
 * @returns Schema build context
 */
export function createSchemaContext(): SchemaBuildContext {
  return {
    components: {},
    seen: new Set()
  };
}

/**
 * Builds a JSON schema from a schema source.
 * @param source - Schema source
 * @param context - Schema build context
 * @returns JSON schema
 */
export function buildSchemaFromSource(source: SchemaSource, context: SchemaBuildContext): JsonSchema {
  if (isSchemaNode(source)) {
    return buildSchemaFromNode(source, context);
  }
  return buildSchemaFromDto(source, context);
}

/**
 * Builds a JSON schema from a DTO constructor.
 * @param dto - DTO constructor
 * @param context - Schema build context
 * @returns JSON schema reference
 */
export function buildSchemaFromDto(dto: DtoConstructor, context: SchemaBuildContext): JsonSchema {
  const name = ensureDtoComponent(dto, context);
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * Ensures a DTO component is registered in the schema context.
 * @param dto - DTO constructor
 * @param context - Schema build context
 * @returns Component name
 */
export function ensureDtoComponent(dto: DtoConstructor, context: SchemaBuildContext): string {
  const dtoMeta = getDtoMeta(dto);
  if (!dtoMeta) {
    throw new Error(`DTO "${dto.name}" is missing @Dto decorator.`);
  }
  if (context.seen.has(dto)) {
    return dtoMeta.name;
  }
  context.seen.add(dto);
  context.components[dtoMeta.name] = buildDtoSchema(dtoMeta, context);
  return dtoMeta.name;
}

/**
 * Builds a JSON schema from DTO metadata.
 * @param meta - DTO metadata
 * @param context - Schema build context
 * @returns JSON schema
 */
export function buildDtoSchema(
  meta: { name: string; description?: string; fields: Record<string, { schema: SchemaNode; optional?: boolean; description?: string }>; additionalProperties?: boolean },
  context: SchemaBuildContext
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [name, field] of Object.entries(meta.fields)) {
    const schema = buildSchemaFromNode(field.schema, context);
    if (field.description && !schema.description) {
      schema.description = field.description;
    }
    properties[name] = schema;
    const isOptional = field.optional ?? field.schema.optional ?? false;
    if (!isOptional) {
      required.push(name);
    }
  }

  const dtoSchema: JsonSchema = {
    type: "object",
    properties,
    additionalProperties: meta.additionalProperties ?? false
  };

  if (required.length) {
    dtoSchema.required = required;
  }
  if (meta.description) {
    dtoSchema.description = meta.description;
  }

  return dtoSchema;
}

/**
 * Builds a JSON schema from a schema node.
 * @param node - Schema node
 * @param context - Schema build context
 * @returns JSON schema
 */
export function buildSchemaFromNode(node: SchemaNode, context: SchemaBuildContext): JsonSchema {
  let schema: JsonSchema;
  switch (node.kind) {
    case "string":
      schema = {
        type: "string",
        format: node.format,
        minLength: node.minLength,
        maxLength: node.maxLength,
        pattern: node.pattern
      };
      break;
    case "number":
    case "integer":
      schema = {
        type: node.kind,
        minimum: node.minimum,
        maximum: node.maximum,
        exclusiveMinimum: node.exclusiveMinimum,
        exclusiveMaximum: node.exclusiveMaximum,
        multipleOf: node.multipleOf
      };
      break;
    case "boolean":
      schema = { type: "boolean" };
      break;
    case "array":
      schema = {
        type: "array",
        items: buildSchemaFromNode(node.items, context),
        minItems: node.minItems,
        maxItems: node.maxItems,
        uniqueItems: node.uniqueItems
      };
      break;
    case "object":
      schema = {
        type: "object",
        properties: node.properties
          ? mapObjectSchemas(node.properties, context)
          : undefined,
        required: node.required,
        additionalProperties:
          typeof node.additionalProperties === "object"
            ? buildSchemaFromNode(node.additionalProperties, context)
            : node.additionalProperties,
        minProperties: node.minProperties,
        maxProperties: node.maxProperties
      };
      break;
    case "enum":
      schema = {
        enum: node.values,
        ...inferEnumType(node.values)
      };
      break;
    case "literal":
      schema = {
        const: node.value,
        ...inferLiteralType(node.value)
      };
      break;
    case "union":
      schema = {
        anyOf: node.anyOf.map((entry) => buildSchemaFromNode(entry, context))
      };
      break;
    case "record":
      schema = {
        type: "object",
        additionalProperties: buildSchemaFromNode(node.values, context)
      };
      break;
    case "ref":
      schema = buildSchemaFromDto(node.dto, context);
      break;
    case "any":
      schema = {};
      break;
    case "null":
      schema = { type: "null" };
      break;
    case "file":
      schema = {
        type: "string",
        format: "binary"
      };
      break;
    default:
      schema = {};
      break;
  }

  schema = applyBaseOptions(schema, node);
  schema = applyNullable(schema, node);
  return stripUndefined(schema);
}

function mapObjectSchemas(
  properties: Record<string, SchemaNode>,
  context: SchemaBuildContext
): Record<string, JsonSchema> {
  const mapped: Record<string, JsonSchema> = {};
  for (const [key, value] of Object.entries(properties)) {
    mapped[key] = buildSchemaFromNode(value, context);
  }
  return mapped;
}

function applyBaseOptions(schema: JsonSchema, node: SchemaNode): JsonSchema {
  if (node.description) schema.description = node.description;
  if (node.title) schema.title = node.title;
  if (node.default !== undefined) schema.default = node.default;
  if (node.examples) schema.examples = node.examples;
  if (node.deprecated !== undefined) schema.deprecated = node.deprecated;
  if (node.readOnly !== undefined) schema.readOnly = node.readOnly;
  if (node.writeOnly !== undefined) schema.writeOnly = node.writeOnly;
  return schema;
}

function applyNullable(schema: JsonSchema, node: SchemaNode): JsonSchema {
  if (!node.nullable) {
    return schema;
  }
  if ("$ref" in schema) {
    return { anyOf: [schema, { type: "null" }] };
  }
  if (schema.type && typeof schema.type === "string") {
    return { ...schema, type: [schema.type, "null"] };
  }
  if (Array.isArray(schema.type)) {
    const types = new Set(schema.type);
    types.add("null");
    return { ...schema, type: Array.from(types) };
  }
  return { anyOf: [schema, { type: "null" }] };
}

function inferEnumType(values: JsonPrimitive[]): JsonSchema {
  const types = new Set<string>();
  for (const value of values) {
    if (value === null) {
      types.add("null");
    } else {
      types.add(typeof value);
    }
  }
  if (!types.size) {
    return {};
  }
  const typeArray = Array.from(types);
  return typeArray.length === 1 ? { type: typeArray[0] } : { type: typeArray };
}

function inferLiteralType(value: JsonPrimitive): JsonSchema {
  if (value === null) {
    return { type: "null" };
  }
  return { type: typeof value };
}

function stripUndefined(schema: JsonSchema): JsonSchema {
  for (const [key, value] of Object.entries(schema)) {
    if (value === undefined) {
      delete schema[key];
    }
  }
  return schema;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && "kind" in (value as SchemaNode);
}
