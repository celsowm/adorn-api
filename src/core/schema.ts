import type { DtoConstructor } from "./types";

/**
 * JSON primitive types.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Base options for all schema types.
 */
export interface BaseSchemaOptions {
  /** Description of the schema */
  description?: string;
  /** Title for the schema */
  title?: string;
  /** Default value */
  default?: unknown;
  /** Example values */
  examples?: unknown[];
  /** Whether the schema is deprecated */
  deprecated?: boolean;
  /** Whether the schema is read-only */
  readOnly?: boolean;
  /** Whether the schema is write-only */
  writeOnly?: boolean;
  /** Whether the schema is optional */
  optional?: boolean;
  /** Whether the schema can be null */
  nullable?: boolean;
}

/**
 * String schema definition.
 * @extends BaseSchemaOptions
 */
export interface StringSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "string";
  /** Format specification (e.g., "uuid", "date-time") */
  format?: string;
  /** Minimum length constraint */
  minLength?: number;
  /** Maximum length constraint */
  maxLength?: number;
  /** Regular expression pattern constraint */
  pattern?: string;
}

/**
 * Number schema definition.
 * @extends BaseSchemaOptions
 */
export interface NumberSchema extends BaseSchemaOptions {
  /** Schema kind identifier ("number" or "integer") */
  kind: "number" | "integer";
  /** Minimum value constraint */
  minimum?: number;
  /** Maximum value constraint */
  maximum?: number;
  /** Exclusive minimum value constraint */
  exclusiveMinimum?: number;
  /** Exclusive maximum value constraint */
  exclusiveMaximum?: number;
  /** Multiple-of constraint */
  multipleOf?: number;
}

/**
 * Boolean schema definition.
 * @extends BaseSchemaOptions
 */
export interface BooleanSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "boolean";
}

/**
 * Array schema definition.
 * @extends BaseSchemaOptions
 */
export interface ArraySchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "array";
  /** Schema for array items */
  items: SchemaNode;
  /** Minimum number of items constraint */
  minItems?: number;
  /** Maximum number of items constraint */
  maxItems?: number;
  /** Whether items must be unique */
  uniqueItems?: boolean;
}

/**
 * Object schema definition.
 * @extends BaseSchemaOptions
 */
export interface ObjectSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "object";
  /** Object properties */
  properties?: Record<string, SchemaNode>;
  /** Required property names */
  required?: string[];
  /** Additional properties configuration */
  additionalProperties?: boolean | SchemaNode;
  /** Minimum number of properties constraint */
  minProperties?: number;
  /** Maximum number of properties constraint */
  maxProperties?: number;
}

/**
 * Enum schema definition.
 * @extends BaseSchemaOptions
 */
export interface EnumSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "enum";
  /** Array of allowed values */
  values: JsonPrimitive[];
}

/**
 * Literal schema definition.
 * @extends BaseSchemaOptions
 */
export interface LiteralSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "literal";
  /** Literal value */
  value: JsonPrimitive;
}

/**
 * Union schema definition.
 * @extends BaseSchemaOptions
 */
export interface UnionSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "union";
  /** Array of possible schemas */
  anyOf: SchemaNode[];
}

/**
 * Record schema definition.
 * @extends BaseSchemaOptions
 */
export interface RecordSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "record";
  /** Schema for record values */
  values: SchemaNode;
}

/**
 * Reference schema definition.
 * @extends BaseSchemaOptions
 */
export interface RefSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "ref";
  /** DTO constructor being referenced */
  dto: DtoConstructor;
}

/**
 * Any schema definition.
 * @extends BaseSchemaOptions
 */
export interface AnySchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "any";
}

/**
 * Null schema definition.
 * @extends BaseSchemaOptions
 */
export interface NullSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "null";
}

/**
 * File schema definition for file uploads.
 * @extends BaseSchemaOptions
 */
export interface FileSchema extends BaseSchemaOptions {
  /** Schema kind identifier */
  kind: "file";
  /** Accepted content types (e.g., "image/*", "application/pdf") */
  accept?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
}

/**
 * Union type representing all possible schema node types.
 */
export type SchemaNode =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | ArraySchema
  | ObjectSchema
  | EnumSchema
  | LiteralSchema
  | UnionSchema
  | RecordSchema
  | RefSchema
  | AnySchema
  | NullSchema
  | FileSchema;

/**
 * Schema source - can be either a schema node or a DTO constructor.
 */
export type SchemaSource = SchemaNode | DtoConstructor;

/**
 * Schema builder object providing helper functions for creating schema nodes.
 */
export const t = {
  /**
   * Creates a string schema.
   * @param opts - String schema options
   * @returns String schema
   */
  string: (opts: Omit<StringSchema, "kind"> = {}): StringSchema => ({
    kind: "string",
    ...opts
  }),

  /**
   * Creates a UUID string schema.
   * @param opts - String schema options
   * @returns UUID string schema
   */
  uuid: (opts: Omit<StringSchema, "kind" | "format"> = {}): StringSchema => ({
    kind: "string",
    format: "uuid",
    ...opts
  }),

  /**
   * Creates a date-time string schema.
   * @param opts - String schema options
   * @returns Date-time string schema
   */
  dateTime: (opts: Omit<StringSchema, "kind" | "format"> = {}): StringSchema => ({
    kind: "string",
    format: "date-time",
    ...opts
  }),

  /**
   * Creates a number schema.
   * @param opts - Number schema options
   * @returns Number schema
   */
  number: (opts: Omit<NumberSchema, "kind"> = {}): NumberSchema => ({
    kind: "number",
    ...opts
  }),

  /**
   * Creates an integer schema.
   * @param opts - Number schema options
   * @returns Integer schema
   */
  integer: (opts: Omit<NumberSchema, "kind"> = {}): NumberSchema => ({
    kind: "integer",
    ...opts
  }),

  /**
   * Creates a boolean schema.
   * @param opts - Boolean schema options
   * @returns Boolean schema
   */
  boolean: (opts: Omit<BooleanSchema, "kind"> = {}): BooleanSchema => ({
    kind: "boolean",
    ...opts
  }),

  /**
   * Creates an array schema.
   * @param items - Schema for array items
   * @param opts - Array schema options
   * @returns Array schema
   */
  array: (items: SchemaNode, opts: Omit<ArraySchema, "kind" | "items"> = {}): ArraySchema => ({
    kind: "array",
    items,
    ...opts
  }),

  /**
   * Creates an object schema.
   * @param properties - Object properties
   * @param opts - Object schema options
   * @returns Object schema
   */
  object: (
    properties: Record<string, SchemaNode>,
    opts: Omit<ObjectSchema, "kind" | "properties"> = {}
  ): ObjectSchema => ({
    kind: "object",
    properties,
    additionalProperties: false,
    ...opts
  }),

  /**
   * Creates a record schema.
   * @param values - Schema for record values
   * @param opts - Record schema options
   * @returns Record schema
   */
  record: (values: SchemaNode, opts: Omit<RecordSchema, "kind" | "values"> = {}): RecordSchema => ({
    kind: "record",
    values,
    ...opts
  }),

  /**
   * Creates an enum schema.
   * @param values - Array of allowed values
   * @param opts - Enum schema options
   * @returns Enum schema
   */
  enum: (values: JsonPrimitive[], opts: Omit<EnumSchema, "kind" | "values"> = {}): EnumSchema => ({
    kind: "enum",
    values,
    ...opts
  }),

  /**
   * Creates a literal schema.
   * @param value - Literal value
   * @param opts - Literal schema options
   * @returns Literal schema
   */
  literal: (value: JsonPrimitive, opts: Omit<LiteralSchema, "kind" | "value"> = {}): LiteralSchema => ({
    kind: "literal",
    value,
    ...opts
  }),

  /**
   * Creates a union schema.
   * @param anyOf - Array of possible schemas
   * @param opts - Union schema options
   * @returns Union schema
   */
  union: (anyOf: SchemaNode[], opts: Omit<UnionSchema, "kind" | "anyOf"> = {}): UnionSchema => ({
    kind: "union",
    anyOf,
    ...opts
  }),

  /**
   * Creates a reference schema.
   * @param dto - DTO constructor being referenced
   * @param opts - Reference schema options
   * @returns Reference schema
   */
  ref: (dto: DtoConstructor, opts: Omit<RefSchema, "kind" | "dto"> = {}): RefSchema => ({
    kind: "ref",
    dto,
    ...opts
  }),

  /**
   * Creates an any schema.
   * @param opts - Any schema options
   * @returns Any schema
   */
  any: (opts: Omit<AnySchema, "kind"> = {}): AnySchema => ({
    kind: "any",
    ...opts
  }),

  /**
   * Creates a null schema.
   * @param opts - Null schema options
   * @returns Null schema
   */
  null: (opts: Omit<NullSchema, "kind"> = {}): NullSchema => ({
    kind: "null",
    ...opts
  }),

  /**
   * Creates a file schema for file uploads.
   * @param opts - File schema options
   * @returns File schema
   */
  file: (opts: Omit<FileSchema, "kind"> = {}): FileSchema => ({
    kind: "file",
    ...opts
  }),

  /**
   * Makes a schema optional.
   * @param schema - Schema to make optional
   * @returns Modified schema with optional flag
   */
  optional: <T extends SchemaNode>(schema: T): T => ({
    ...schema,
    optional: true
  }),

  /**
   * Makes a schema nullable.
   * @param schema - Schema to make nullable
   * @returns Modified schema with nullable flag
   */
  nullable: <T extends SchemaNode>(schema: T): T => ({
    ...schema,
    nullable: true
  })
};
