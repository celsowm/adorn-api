import { META, type ControllerMeta } from '../metadata/keys';
import { bagFromContext, bagSet } from '../metadata/bag';

/**
 * Stage-3 class decorator.
 * Usage: @Controller('/users')
 */
export function Controller(basePath: string) {
  return function (_value: Function, context: ClassDecoratorContext) {
    const bag = bagFromContext(context);

    const meta: ControllerMeta = {
      basePath: normalizeBasePath(basePath),
    };

    bagSet(bag, META.controller, meta);
  };
}

function normalizeBasePath(p: string): string {
  if (!p) return '';
  let out = p.trim();
  if (!out.startsWith('/')) out = `/${out}`;
  if (out !== '/' && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}
