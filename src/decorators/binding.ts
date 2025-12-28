import { META, type BindingsMeta } from '../metadata/keys.js';
import { bagFromContext, bagEnsureObject } from '../metadata/bag.js';

export type BindingsOptions = {
  /**
   * Hint coercion for path params by name.
   * Example: @Bindings({ path: { id: 'int' } })
   */
  path?: Record<string, 'string' | 'int' | 'number' | 'boolean' | 'uuid'>;
};

export function Bindings(opts: BindingsOptions) {
  return function (_value: Function, context: ClassMethodDecoratorContext) {
    const bag = bagFromContext(context);
    const meta = bagEnsureObject<BindingsMeta>(bag, META.bindings, () => ({}));

    const method = String(context.name);
    meta.byMethod ??= {};
    meta.byMethod[method] ??= {};

    if (opts.path) {
      meta.byMethod[method].path = {
        ...(meta.byMethod[method].path ?? {}),
        ...opts.path,
      };
    }
  };
}
