import { z } from 'zod';
import { named, type SchemaRef } from '../../core/schema.js';
import type { SchemaProvider } from './schema-provider.js';

export const zodSchemaProvider: SchemaProvider<z.ZodTypeAny> = {
  id: 'zod',
  string: () => z.string(),
  number: () => z.number(),
  boolean: () => z.boolean(),
  any: () => z.any(),
  array: (schema) => z.array(schema),
  object: (shape) => z.object(shape),
  optional: (schema) => schema.optional(),
  nullable: (schema) => schema.nullable(),
  int: (schema) => (schema as z.ZodNumber).int(),
  uuid: (schema) => (schema as z.ZodString).uuid(),
  email: (schema) => (schema as z.ZodString).email(),
  minLength: (schema, min) => (schema as z.ZodString).min(min),
  coerceNumber: (schema) =>
    z.preprocess((value) => (typeof value === 'string' ? Number(value) : value), schema),
  toSchemaRef: (id, schema) => named(id, schema) as SchemaRef,
};

