import { addContract } from './registry.js';
import type { Contract, ContractId } from './types.js';

export const registerContract = <TQuery = unknown, TItem = unknown, TResult = unknown>(
  id: ContractId,
  definition: Omit<Contract<TQuery, TItem, TResult>, 'id'>
): Contract<TQuery, TItem, TResult> => {
  const contract: Contract<TQuery, TItem, TResult> = { id, ...definition };
  return addContract(contract);
};
