export const mergeSchemas = (...schemas: Array<Record<string, unknown> | undefined>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const schema of schemas) {
    if (!schema) continue;
    for (const [key, value] of Object.entries(schema)) {
      result[key] = value;
    }
  }
  return result;
};

export const schemaRef = (name: string): Record<string, unknown> => ({
  $ref: `#/components/schemas/${name}`
});

export const objectSchema = (
  properties: Record<string, unknown>,
  required: readonly string[] = []
): Record<string, unknown> => {
  const schema: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) {
    schema.required = Array.from(required);
  }
  return schema;
};

export const arraySchema = (items: unknown): Record<string, unknown> => ({
  type: 'array',
  items
});

export const pickSchemaProperties = <T extends Record<string, unknown>, K extends keyof T>(
  properties: T,
  keys: readonly K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = properties[key];
  }
  return result;
};
