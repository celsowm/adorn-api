import type { DtoConstructor } from "./types";

export type JsonPrimitive = string | number | boolean | null;

export interface BaseSchemaOptions {
  description?: string;
  title?: string;
  default?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  optional?: boolean;
  nullable?: boolean;
}

export interface StringSchema extends BaseSchemaOptions {
  kind: "string";
  format?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface NumberSchema extends BaseSchemaOptions {
  kind: "number" | "integer";
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
}

export interface BooleanSchema extends BaseSchemaOptions {
  kind: "boolean";
}

export interface ArraySchema extends BaseSchemaOptions {
  kind: "array";
  items: SchemaNode;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface ObjectSchema extends BaseSchemaOptions {
  kind: "object";
  properties?: Record<string, SchemaNode>;
  required?: string[];
  additionalProperties?: boolean | SchemaNode;
  minProperties?: number;
  maxProperties?: number;
}

export interface EnumSchema extends BaseSchemaOptions {
  kind: "enum";
  values: JsonPrimitive[];
}

export interface LiteralSchema extends BaseSchemaOptions {
  kind: "literal";
  value: JsonPrimitive;
}

export interface UnionSchema extends BaseSchemaOptions {
  kind: "union";
  anyOf: SchemaNode[];
}

export interface RecordSchema extends BaseSchemaOptions {
  kind: "record";
  values: SchemaNode;
}

export interface RefSchema extends BaseSchemaOptions {
  kind: "ref";
  dto: DtoConstructor;
}

export interface AnySchema extends BaseSchemaOptions {
  kind: "any";
}

export interface NullSchema extends BaseSchemaOptions {
  kind: "null";
}

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
  | NullSchema;

export type SchemaSource = SchemaNode | DtoConstructor;

export const t = {
  string: (opts: Omit<StringSchema, "kind"> = {}): StringSchema => ({
    kind: "string",
    ...opts
  }),
  uuid: (opts: Omit<StringSchema, "kind" | "format"> = {}): StringSchema => ({
    kind: "string",
    format: "uuid",
    ...opts
  }),
  dateTime: (opts: Omit<StringSchema, "kind" | "format"> = {}): StringSchema => ({
    kind: "string",
    format: "date-time",
    ...opts
  }),
  number: (opts: Omit<NumberSchema, "kind"> = {}): NumberSchema => ({
    kind: "number",
    ...opts
  }),
  integer: (opts: Omit<NumberSchema, "kind"> = {}): NumberSchema => ({
    kind: "integer",
    ...opts
  }),
  boolean: (opts: Omit<BooleanSchema, "kind"> = {}): BooleanSchema => ({
    kind: "boolean",
    ...opts
  }),
  array: (items: SchemaNode, opts: Omit<ArraySchema, "kind" | "items"> = {}): ArraySchema => ({
    kind: "array",
    items,
    ...opts
  }),
  object: (
    properties: Record<string, SchemaNode>,
    opts: Omit<ObjectSchema, "kind" | "properties"> = {}
  ): ObjectSchema => ({
    kind: "object",
    properties,
    ...opts
  }),
  record: (values: SchemaNode, opts: Omit<RecordSchema, "kind" | "values"> = {}): RecordSchema => ({
    kind: "record",
    values,
    ...opts
  }),
  enum: (values: JsonPrimitive[], opts: Omit<EnumSchema, "kind" | "values"> = {}): EnumSchema => ({
    kind: "enum",
    values,
    ...opts
  }),
  literal: (value: JsonPrimitive, opts: Omit<LiteralSchema, "kind" | "value"> = {}): LiteralSchema => ({
    kind: "literal",
    value,
    ...opts
  }),
  union: (anyOf: SchemaNode[], opts: Omit<UnionSchema, "kind" | "anyOf"> = {}): UnionSchema => ({
    kind: "union",
    anyOf,
    ...opts
  }),
  ref: (dto: DtoConstructor, opts: Omit<RefSchema, "kind" | "dto"> = {}): RefSchema => ({
    kind: "ref",
    dto,
    ...opts
  }),
  any: (opts: Omit<AnySchema, "kind"> = {}): AnySchema => ({
    kind: "any",
    ...opts
  }),
  null: (opts: Omit<NullSchema, "kind"> = {}): NullSchema => ({
    kind: "null",
    ...opts
  }),
  optional: <T extends SchemaNode>(schema: T): T => ({
    ...schema,
    optional: true
  }),
  nullable: <T extends SchemaNode>(schema: T): T => ({
    ...schema,
    nullable: true
  })
};
