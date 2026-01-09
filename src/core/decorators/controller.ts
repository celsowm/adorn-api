import { mergeControllerMeta } from '../metadata/collector.js';
import { registerController } from '../metadata/registry.js';

export interface ControllerOptions {
  path?: string;
  tags?: string[];
}

export const Controller = (options: ControllerOptions = {}) => {
  return (value: Function, context: ClassDecoratorContext): void => {
    mergeControllerMeta(context, { basePath: options.path, tags: options.tags });
    context.addInitializer(() => registerController(value));
  };
};
