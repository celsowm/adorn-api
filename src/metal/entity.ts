const entitySchemas = new Map<string, unknown>();

export const registerEntitySchema = (name: string, schema: unknown): void => {
  entitySchemas.set(name, schema);
};

export const getEntitySchema = (name: string): unknown | undefined => entitySchemas.get(name);

export const listEntitySchemas = (): Array<{ name: string; schema: unknown }> =>
  Array.from(entitySchemas.entries()).map(([name, schema]) => ({ name, schema }));
