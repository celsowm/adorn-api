import { getContract } from './registry.js';
import type { Contract, ContractRef, ContractSchemas } from './types.js';

export interface ResolvedContract extends Contract {
  schemas?: ContractSchemas;
}

export const resolveContract = (contract: Contract): ResolvedContract => {
  const schemas = contract.schemas ?? contract.resolveSchemas?.();
  return { ...contract, schemas };
};

export const resolveContractRef = (ref: ContractRef | undefined): ResolvedContract | undefined => {
  if (!ref) return undefined;
  if (typeof ref === 'string' || typeof ref === 'symbol') {
    const contract = getContract(ref);
    return contract ? resolveContract(contract) : undefined;
  }
  return resolveContract(ref);
};
