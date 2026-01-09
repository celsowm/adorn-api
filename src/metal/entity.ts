import { extractSchema, getTableDefFromEntity } from 'metal-orm';

import { registerOpenApiEnhancer, type OpenApiSpecEnhancer } from '../openapi/builder.js';
import { pickSchemaProperties, schemaRef } from '../openapi/schema.js';
import type { Constructor } from '../util/types.js';
import type { OpenApiSchema, SchemaOptions } from 'metal-orm';
import { mergeOpenApiComponents } from './schema-bridge.js';

const entitySchemas = new Map<string, unknown>();

export const registerEntitySchema = (name: string, schema: unknown): void => {
  entitySchemas.set(name, schema);
};

export const defineEntitySchema = (name: string, schema: unknown): Record<string, unknown> => {
  registerEntitySchema(name, schema);
  return schemaRef(name);
};

export type EntitySchemaSelection = {
  pick?: readonly string[];
  omit?: readonly string[];
  overrides?: Record<string, unknown>;
};

export type EntitySchemaBundleOptions = {
  name: string;
  inputName?: string;
  schemaOptions?: SchemaOptions;
  output?: EntitySchemaSelection;
  input?: EntitySchemaSelection | false;
};

const applyEntitySchemaSelection = (
  schema: OpenApiSchema,
  selection?: EntitySchemaSelection
): OpenApiSchema => {
  if (!selection) return schema;

  const baseKeys = selection.pick
    ? [...selection.pick]
    : Object.keys(schema.properties).filter(key => !selection.omit?.includes(key));

  const overrideKeys = selection.overrides ? Object.keys(selection.overrides) : [];
  const keys = overrideKeys.length > 0 ? Array.from(new Set([...baseKeys, ...overrideKeys])) : baseKeys;
  const properties = pickSchemaProperties(schema.properties as Record<string, unknown>, keys) as OpenApiSchema['properties'];

  if (selection.overrides) {
    for (const [key, value] of Object.entries(selection.overrides)) {
      properties[key] = value as OpenApiSchema['properties'][string];
    }
  }

  const required = Array.isArray(schema.required)
    ? schema.required.filter(key => keys.includes(key))
    : [];

  return { ...schema, properties, required };
};

export const defineEntitySchemaBundle = (
  ctor: Constructor,
  options: EntitySchemaBundleOptions
): { output: Record<string, unknown>; input?: Record<string, unknown>; parameters?: unknown } => {
  const table = getTableDefFromEntity(ctor as never);
  if (!table) {
    throw new Error(`Entity '${ctor.name}' is not registered with decorators or has not been bootstrapped`);
  }

  const bundle = extractSchema(table, undefined, undefined, options.schemaOptions);
  const outputSchema = applyEntitySchemaSelection(bundle.output, options.output);
  const output = defineEntitySchema(options.name, outputSchema);

  if (bundle.input && options.input !== false) {
    const inputSchema = applyEntitySchemaSelection(bundle.input, options.input);
    const inputName = options.inputName ?? `${options.name}Input`;
    return {
      output,
      input: defineEntitySchema(inputName, inputSchema),
      parameters: bundle.parameters
    };
  }

  return { output, parameters: bundle.parameters };
};

export const getEntitySchema = (name: string): unknown | undefined => entitySchemas.get(name);

export const listEntitySchemas = (): Array<{ name: string; schema: unknown }> =>
  Array.from(entitySchemas.entries()).map(([name, schema]) => ({ name, schema }));

export const getEntitySchemaComponents = (): Record<string, unknown> => ({
  schemas: Object.fromEntries(entitySchemas)
});

export const enhanceOpenApiWithEntitySchemas: OpenApiSpecEnhancer = spec => {
  spec.components = mergeOpenApiComponents(spec.components, getEntitySchemaComponents());
};

registerOpenApiEnhancer(enhanceOpenApiWithEntitySchemas);
