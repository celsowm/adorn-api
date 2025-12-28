import type { OpenAPIV3 } from 'openapi-types';
import type { Schema } from '../../../validation/native/schema.js';
import { irToOasSchema } from './toOpenApi.js';

export class OasSchemaRegistry {
  private components: Record<string, OpenAPIV3.SchemaObject> = {};
  private seen = new WeakMap<object, string>();

  toSchemaRef(schema: Schema<any>): OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject {
    if (schema.name) {
      const existing = this.seen.get(schema as object);
      const name = existing ?? schema.name;

      if (!existing) {
        this.seen.set(schema as object, name);
        this.components[name] = irToOasSchema(schema.ir);
      }

      return { $ref: `#/components/schemas/${name}` };
    }

    return irToOasSchema(schema.ir);
  }

  getComponents(): OpenAPIV3.ComponentsObject {
    return {
      schemas: Object.keys(this.components).length ? this.components : undefined,
    };
  }
}
