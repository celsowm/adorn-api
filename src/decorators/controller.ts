import { META, type ControllerMeta } from '../metadata/keys.js';
import { bagFromContext, bagSet } from '../metadata/bag.js';

/**
 * Stage-3 class decorator.
 * Usage: @Controller('/users')
 */
export function Controller(basePath: string) {
  return function (_value: unknown, context: ClassDecoratorContext) {
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
