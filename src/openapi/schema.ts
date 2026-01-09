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
