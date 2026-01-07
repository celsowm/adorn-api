/**
 * Converts Metal ORM entity decorators into JSON Schema for OpenAPI.
 */
import { readMetalDecoratorBagFromConstructor, type MetalColumnDef } from "./readMetalBag.js";

/**
 * JSON Schema representation for OpenAPI.
 */
export type JsonSchema = Record<string, any>;

/**
 * Schema generation mode determining which fields are included.
 * - "read": All fields (read-only marked on primary keys)
 * - "create": Exclude auto-generated fields (primary keys, autoIncrement)
 * - "update": All fields (none required)
 */
export type EntitySchemaMode = "read" | "create" | "update";

/**
 * Options for generating a JSON Schema from an entity.
 */
export interface SchemaFromEntityOptions {
  /** Custom name for the schema (defaults to entity class name) */
  name?: string;
  /** Strip "Entity" suffix from class name (default: true) */
  stripEntitySuffix?: boolean;
  /** Schema generation mode (default: "read") */
  mode?: EntitySchemaMode;
  /** Allow additional properties not defined in schema (default: true) */
  additionalProperties?: boolean;
  /** How to handle relations in the schema (default: "none") */
  includeRelations?: "none" | "inline";
}

function defaultSchemaName(ctor: Function, strip: boolean) {
  const raw = ctor.name || "AnonymousEntity";
  return strip ? raw.replace(/Entity$/i, "") || raw : raw;
}

function columnTypeToSchema(col: MetalColumnDef): JsonSchema {
  const t = String(col.type).toLowerCase();
  const s: JsonSchema = {};

  if (["varchar", "text", "string", "char", "citext"].includes(t)) {
    s.type = "string";
    const a0 = Array.isArray(col.args) ? col.args[0] : undefined;
    if (typeof a0 === "number" && Number.isFinite(a0) && a0 > 0) s.maxLength = a0;
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["uuid"].includes(t)) {
    s.type = "string";
    s.format = "uuid";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["timestamp", "timestamptz", "datetime"].includes(t)) {
    s.type = "string";
    s.format = "date-time";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }
  if (["date"].includes(t)) {
    s.type = "string";
    s.format = "date";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["bool", "boolean"].includes(t)) {
    s.type = "boolean";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["int", "int4", "integer", "smallint", "int2", "serial", "bigserial"].includes(t)) {
    s.type = "integer";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["bigint", "int8"].includes(t)) {
    s.type = "string";
    s.format = "int64";
    s.pattern = "^-?\\d+$";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["float", "float4", "float8", "double", "decimal", "numeric", "real"].includes(t)) {
    s.type = "number";
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  if (["json", "jsonb"].includes(t)) {
    s.type = ["object", "array", "string", "number", "boolean", "null"];
    if (typeof col.comment === "string") s.description = col.comment;
    return s;
  }

  s.type = "string";
  if (typeof col.comment === "string") s.description = col.comment;
  return s;
}

function isLiteralDefault(v: unknown) {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function makeNullable(schema: JsonSchema): JsonSchema {
  if (schema.type === "null") return schema;
  if (Array.isArray(schema.type)) {
    if (!schema.type.includes("null")) schema.type = [...schema.type, "null"];
    return schema;
  }
  if (typeof schema.type === "string") {
    schema.type = [schema.type, "null"];
  } else {
    schema.type = ["null"];
  }
  return schema;
}

function isGenerated(col: MetalColumnDef) {
  return !!col.primary || !!col.autoIncrement || (col.generated !== null && col.generated !== undefined);
}

function shouldIncludeColumn(col: MetalColumnDef, mode: "read" | "create" | "update") {
  if (mode === "read") return true;
  if (mode === "create") return !isGenerated(col);
  if (mode === "update") return true;
  return true;
}

function shouldRequire(col: MetalColumnDef, mode: "read" | "create" | "update") {
  if (mode === "update") return false;
  if (!col.notNull) return false;
  if (mode === "create" && (col.default !== null && col.default !== undefined)) return false;
  return true;
}

/**
 * Generates a JSON Schema from a Metal ORM entity class.
 * 
 * @param ctor - The entity class constructor
 * @param opts - Schema generation options
 * @returns JSON Schema object or undefined if entity has no columns
 * 
 * @example
 * ```ts
 * const schema = schemaFromEntity(User, { mode: "create" });
 * // Returns: { title: "User", type: "object", properties: {...}, required: [...] }
 * ```
 */
export function schemaFromEntity(ctor: Function, opts: SchemaFromEntityOptions = {}): JsonSchema | undefined {
  const bag = readMetalDecoratorBagFromConstructor(ctor);
  if (!bag || !Array.isArray(bag.columns) || bag.columns.length === 0) return undefined;

  const mode = opts.mode ?? "read";
  const name = opts.name ?? defaultSchemaName(ctor, opts.stripEntitySuffix ?? true);

  const schema: JsonSchema = {
    title: name,
    type: "object",
    properties: {},
    additionalProperties: opts.additionalProperties ?? true
  };

  const required: string[] = [];

  for (const entry of bag.columns) {
    const prop = entry.propertyName;
    const col = entry.column;

    if (!shouldIncludeColumn(col, mode)) continue;

    const propSchema = columnTypeToSchema(col);

    if (!col.notNull) makeNullable(propSchema);

    if (isLiteralDefault(col.default)) propSchema.default = col.default;

    if (mode === "read" && col.primary) propSchema.readOnly = true;

    (schema.properties as any)[prop] = propSchema;

    if (shouldRequire(col, mode)) required.push(prop);
  }

  if (required.length) schema.required = required;

  if ((opts.includeRelations ?? "none") === "inline") {
    for (const r of bag.relations ?? []) {
      const rel = r.relation;
      if (typeof rel?.target !== "function") continue;

      let target: any;
      try {
        target = rel.target();
      } catch {
        continue;
      }
      if (typeof target !== "function") continue;

      const targetName = defaultSchemaName(target, true);
      (schema.properties as any)[r.propertyName] = { $ref: `#/components/schemas/${targetName}` };
    }
  }

  return schema;
}
