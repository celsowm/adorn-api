import type { SchemaRef } from '../../core/schema.js';
import type { SimpleSchema } from '../../core/simple-schema.js';

export type SchemaProvider<TSchema = unknown> = {
  id: string;
  string(): TSchema;
  number(): TSchema;
  boolean(): TSchema;
  any(): TSchema;
  array(schema: TSchema): TSchema;
  object(shape: Record<string, TSchema>): TSchema;
  optional(schema: TSchema): TSchema;
  nullable(schema: TSchema): TSchema;
  int?(schema: TSchema): TSchema;
  uuid?(schema: TSchema): TSchema;
  email?(schema: TSchema): TSchema;
  minLength?(schema: TSchema, min: number): TSchema;
  coerceNumber?(schema: TSchema): TSchema;
  toSchemaRef(id: string, schema: TSchema): SchemaRef;
};

type OptionalMarker = { 'x-adorn-optional'?: true };

function isOptionalSchema(schema: SimpleSchema): boolean {
  return schema['x-adorn-optional'] === true;
}

function stripOptionalMarker(schema: SimpleSchema): SimpleSchema {
  if (!isOptionalSchema(schema)) return schema;
  const { ['x-adorn-optional']: _opt, ...rest } = schema;
  return rest;
}

function mapAnyOf(schema: SimpleSchema, fn: (s: SimpleSchema) => SimpleSchema): SimpleSchema {
  if (!schema.anyOf) return fn(schema);
  return { ...schema, anyOf: schema.anyOf.map((s) => mapAnyOf(s, fn)) };
}

function setType(schema: SimpleSchema, type: string): SimpleSchema {
  return { ...schema, type };
}

export const simpleSchemaProvider: SchemaProvider<SimpleSchema> = {
  id: 'simple',
  string: () => ({ type: 'string' }),
  number: () => ({ type: 'number' }),
  boolean: () => ({ type: 'boolean' }),
  any: () => ({ type: 'any' }),
  array: (schema) => ({ type: 'array', items: schema }),
  object: (shape) => {
    const properties: Record<string, SimpleSchema> = {};
    const required: string[] = [];
    for (const [key, schema] of Object.entries(shape)) {
      const optional = isOptionalSchema(schema);
      properties[key] = stripOptionalMarker(schema);
      if (!optional) required.push(key);
    }
    return {
      type: 'object',
      properties,
      required: required.length ? required : undefined,
      additionalProperties: true,
    };
  },
  optional: (schema) => ({ ...schema, 'x-adorn-optional': true }),
  nullable: (schema) => ({ anyOf: [schema, { type: 'null' }] }),
  int: (schema) => mapAnyOf(schema, (s) => (s.type === 'number' ? setType(s, 'integer') : s)),
  uuid: (schema) => mapAnyOf(schema, (s) => (s.type === 'string' ? { ...s, format: 'uuid' } : s)),
  email: (schema) => mapAnyOf(schema, (s) => (s.type === 'string' ? { ...s, format: 'email' } : s)),
  minLength: (schema, min) =>
    mapAnyOf(schema, (s) => (s.type === 'string' ? { ...s, minLength: min } : s)),
  coerceNumber: (schema) => ({ ...schema, 'x-adorn-coerce': 'number' }),
  toSchemaRef: (id, schema) => ({ provider: 'simple', id, schema }),
};

