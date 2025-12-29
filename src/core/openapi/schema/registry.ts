import type { ComponentsObject, ReferenceObject, SchemaObject } from '../../../contracts/openapi-v3.js';
import type { Schema } from '../../../validation/native/schema.js';
import { irToOasSchema } from './toOpenApi.js';

export class OasSchemaRegistry {
  private components: Record<string, SchemaObject> = {};
  private seen = new WeakMap<object, string>();

  toSchemaRef(schema: Schema<unknown>): SchemaObject | ReferenceObject {
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

  getComponents(): ComponentsObject {
    return Object.keys(this.components).length ? { schemas: this.components } : {};
  }
}
