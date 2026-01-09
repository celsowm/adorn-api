import { mergeMethodMeta } from '../metadata/collector.js';
import type { ResponseMeta } from '../metadata/types.js';

export const Response = (status: number, description?: string) => {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    const entry: ResponseMeta = { status, description };
    mergeMethodMeta(context, { responses: [entry] });
  };
};

export const Throws = Response;
