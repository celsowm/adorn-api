import { dtoToOpenApiSchema, getTableDefFromEntity } from "metal-orm";

export class SchemaModifier {
  private base: any;

  constructor(public readonly original: any) {
    if (typeof this.original === "function") {
      const entity = (this.original as any)();
      const tableDef = getTableDefFromEntity(entity);
      if (tableDef) {
        this.base = dtoToOpenApiSchema(tableDef);
      }
    } else if (typeof this.original === "object") {
      this.base = this.original;
    } else {
      const tableDef = getTableDefFromEntity(this.original);
      if (tableDef) {
        this.base = dtoToOpenApiSchema(tableDef);
      }
    }
  }

  omit(...fields: string[]): this {
    if (!this.base.properties) return this;

    const filtered = Object.fromEntries(
      Object.entries(this.base.properties).filter(
        ([key]) => !fields.includes(key),
      ),
    );

    return {
      ...this.base,
      properties: filtered,
    };
  }

  only(...fields: string[]): this {
    if (!this.base.properties) return this;

    const filtered = Object.fromEntries(
      Object.entries(this.base.properties).filter(([key]) =>
        fields.includes(key),
      ),
    );

    return {
      ...this.base,
      properties: filtered,
    };
  }

  addComputed(name: string, schema: any): this {
    if (!this.base.properties) return this;

    return {
      ...this.base,
      properties: {
        ...this.base.properties,
        [name]: schema,
      },
    };
  }

  rename(mapping: Record<string, string>): this {
    if (!this.base.properties) return this;

    const properties = Object.fromEntries(
      Object.entries(this.base.properties).map(([key, value]) => [
        mapping[key] || key,
        value,
      ]),
    );

    return {
      ...this.base,
      properties,
    };
  }

  toOpenApi(): any {
    return this.base;
  }
}
