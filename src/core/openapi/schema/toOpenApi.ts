import type { OpenAPIV3 } from 'openapi-types';
import type { SchemaIR } from '../../../validation/native/ir.js';

export function irToOasSchema(ir: SchemaIR): OpenAPIV3.SchemaObject {
  switch (ir.kind) {
    case 'string': {
      const out: OpenAPIV3.SchemaObject = { type: 'string' };
      if (ir.minLength !== undefined) out.minLength = ir.minLength;
      if (ir.maxLength !== undefined) out.maxLength = ir.maxLength;
      if (ir.pattern) out.pattern = ir.pattern;
      if (ir.format) out.format = ir.format;
      if (ir.enum) out.enum = ir.enum;
      return out;
    }

    case 'number': {
      const out: OpenAPIV3.SchemaObject = { type: ir.int ? 'integer' : 'number' };
      if (ir.int) out.format = 'int32';
      if (ir.min !== undefined) out.minimum = ir.min;
      if (ir.max !== undefined) out.maximum = ir.max;
      return out;
    }

    case 'boolean':
      return { type: 'boolean' };

    case 'literal': {
      if (ir.value === null) return { nullable: true };
      if (typeof ir.value === 'string') {
        return { type: 'string', enum: [ir.value] };
      }
      if (typeof ir.value === 'number') {
        return { type: 'number', enum: [ir.value] };
      }
      if (typeof ir.value === 'boolean') {
        return { type: 'boolean', enum: [ir.value] };
      }
      return { enum: [ir.value] };
    }

    case 'array': {
      const out: OpenAPIV3.SchemaObject = {
        type: 'array',
        items: irToOasSchema(ir.items),
      };
      if (ir.minItems !== undefined) out.minItems = ir.minItems;
      if (ir.maxItems !== undefined) out.maxItems = ir.maxItems;
      return out;
    }

    case 'object': {
      const props: Record<string, OpenAPIV3.SchemaObject> = {};
      for (const [k, v] of Object.entries(ir.properties)) {
        props[k] = irToOasSchema(v);
      }

      const out: OpenAPIV3.SchemaObject = {
        type: 'object',
        properties: props,
      };
      if (ir.required.length) out.required = ir.required;
      if (ir.strict) out.additionalProperties = false;
      return out;
    }

    case 'optional':
      return irToOasSchema(ir.inner);

    case 'nullable': {
      const out = irToOasSchema(ir.inner);
      out.nullable = true;
      return out;
    }

    case 'union':
      return { anyOf: ir.anyOf.map(irToOasSchema) };

    default:
      return {};
  }
}
