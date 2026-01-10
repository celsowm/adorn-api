import { createParamProxy } from 'metal-orm';

import { registerContract } from '../builder.js';
import type { Contract, ContractMode, ContractSchemas } from '../types.js';

export interface MetalContractOptions {
  mode?: ContractMode;
  schemaOptions?: unknown;
  schemaOverrides?: MetalSchemaOverrides;
}

export type MetalSchemaOverrides =
  | Partial<ContractSchemas>
  | ((schemas: ContractSchemas) => ContractSchemas);

const applySchemaOverrides = (
  schemas: ContractSchemas,
  overrides?: MetalSchemaOverrides
): ContractSchemas => {
  if (!overrides) return schemas;
  if (typeof overrides === 'function') {
    return overrides(schemas);
  }
  return { ...schemas, ...overrides };
};

export const createMetalContract = <
  TQuery = unknown,
  TItem = unknown,
  TQB = any
>(
  id: string,
  build: (query: TQuery) => TQB,
  options: MetalContractOptions = {}
): Contract<TQuery, TItem, unknown> => {
  const resolveSchemas = (): ContractSchemas => {
    const schemaQuery = createParamProxy() as unknown as TQuery;
    const qb = build(schemaQuery);
    const bundle = (qb as any).getSchema(options.schemaOptions);
    const schemas = {
      output: bundle.output,
      input: bundle.input,
      parameters: bundle.parameters,
      components: bundle.components
    };
    return applySchemaOverrides(schemas, options.schemaOverrides);
  };

  return registerContract(id, {
    mode: options.mode ?? 'list',
    resolveSchemas,
    build
  });
};
