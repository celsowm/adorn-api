import type { Schema } from '../../validation/native/schema.js';
import type { SchemaIR } from '../../validation/native/ir.js';

export type JsonSchema = Record<string, unknown>;

export function schemaToJsonSchema(schema: Schema<unknown>): JsonSchema {
  return irToJsonSchema(schema.ir);
}

export function irToJsonSchema(ir: SchemaIR): JsonSchema {
  switch (ir.kind) {
    case 'string': {
      const out: JsonSchema = { type: 'string' };
      if (ir.minLength !== undefined) out.minLength = ir.minLength;
      if (ir.maxLength !== undefined) out.maxLength = ir.maxLength;
      if (ir.pattern !== undefined) out.pattern = ir.pattern;
      if (ir.format !== undefined) out.format = ir.format;
      if (ir.enum !== undefined) out.enum = ir.enum;
      return out;
    }

    case 'number': {
      const out: JsonSchema = { type: ir.int ? 'integer' : 'number' };
      if (ir.min !== undefined) out.minimum = ir.min;
      if (ir.max !== undefined) out.maximum = ir.max;
      return out;
    }

    case 'boolean':
      return { type: 'boolean' };

    case 'literal':
      return { const: ir.value };

    case 'array': {
      const out: JsonSchema = {
        type: 'array',
        items: irToJsonSchema(ir.items),
      };
      if (ir.minItems !== undefined) out.minItems = ir.minItems;
      if (ir.maxItems !== undefined) out.maxItems = ir.maxItems;
      return out;
    }

    case 'object': {
      const props: Record<string, JsonSchema> = {};
      for (const [k, v] of Object.entries(ir.properties)) {
        props[k] = irToJsonSchema(v);
      }

      const out: JsonSchema = {
        type: 'object',
        properties: props,
      };

      if (ir.required?.length) out.required = [...ir.required];

      if (ir.strict) out.additionalProperties = false;

      return out;
    }

    case 'union':
      return { anyOf: ir.anyOf.map(irToJsonSchema) };

    case 'optional':
      return irToJsonSchema(ir.inner);

    case 'nullable': {
      const inner = irToJsonSchema(ir.inner);
      const t = (inner as { type?: string | string[] }).type;

      if (typeof t === 'string') return { ...inner, type: [t, 'null'] };
      if (Array.isArray(t) && !t.includes('null')) return { ...inner, type: [...t, 'null'] };

      return { anyOf: [inner, { type: 'null' }] };
    }

    default:
      return {};
  }
}
