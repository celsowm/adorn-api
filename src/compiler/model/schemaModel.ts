export interface SchemaModel {
  name: string;
  description?: string;
  payload: Record<string, unknown>;
}

export function createSchemaModel(name: string): SchemaModel {
  return { name, payload: {} };
}
