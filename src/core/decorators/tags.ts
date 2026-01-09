import { mergeControllerMeta, mergeMethodMeta } from '../metadata/collector.js';

export const Tags = (...tags: string[]) => {
  return (_value: unknown, context: ClassDecoratorContext | ClassMethodDecoratorContext): void => {
    if (context.kind === 'class') {
      mergeControllerMeta(context, { tags });
      return;
    }
    mergeMethodMeta(context, { tags });
  };
};

export const Summary = (summary: string) => {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    mergeMethodMeta(context, { summary });
  };
};

export const Deprecated = (deprecated = true) => {
  return (_value: unknown, context: ClassMethodDecoratorContext): void => {
    mergeMethodMeta(context, { deprecated });
  };
};
