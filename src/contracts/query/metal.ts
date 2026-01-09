import { createParamProxy } from 'metal-orm';
import type { OpenApiSchemaBundle, SelectQueryBuilder } from 'metal-orm';

import { registerContract } from '../builder.js';
import type { Contract, ContractMode, ContractSchemas } from '../types.js';

export interface MetalContractOptions {
  mode?: ContractMode;
  schemaOptions?: unknown;
}

type MetalQueryBuilder<TQuery> = SelectQueryBuilder<any, any> & {
  getSchema(options?: unknown): OpenApiSchemaBundle;
};

export const createMetalContract = <TQuery = unknown, TItem = unknown>(
  id: string,
  build: (query: TQuery) => MetalQueryBuilder<TQuery>,
  options: MetalContractOptions = {}
): Contract<TQuery, TItem, unknown> => {
  const resolveSchemas = (): ContractSchemas => {
    const schemaQuery = createParamProxy() as unknown as TQuery;
    const qb = build(schemaQuery);
    const bundle = qb.getSchema(options.schemaOptions);
    return {
      output: bundle.output,
      input: bundle.input,
      parameters: bundle.parameters
    };
  };

  return registerContract(id, {
    mode: options.mode ?? 'list',
    resolveSchemas,
    build
  });
};
