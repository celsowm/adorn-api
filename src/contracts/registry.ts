import type { Contract, ContractId } from './types.js';

const registry = new Map<ContractId, Contract>();

export const addContract = <TQuery, TItem, TResult>(
  contract: Contract<TQuery, TItem, TResult>
): Contract<TQuery, TItem, TResult> => {
  registry.set(contract.id, contract as Contract);
  return contract;
};

export const getContract = (id: ContractId): Contract | undefined => registry.get(id);

export const listContracts = (): Contract[] => Array.from(registry.values());
