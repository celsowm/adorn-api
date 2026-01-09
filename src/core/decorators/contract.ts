import { mergeMethodMeta } from '../metadata/collector.js';
import type { ContractRef } from '../../contracts/types.js';

export const Contract = (contract: ContractRef) => {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    mergeMethodMeta(context, { contract });
  };
};

export const UseContract = Contract;
