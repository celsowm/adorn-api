import type { HttpContext } from './context.js';

export type BindingKind = 'context' | 'query' | 'params' | 'body' | 'headers' | 'state';

export interface ArgBinding {
  index: number;
  kind: BindingKind;
}

export const bindArgs = (ctx: HttpContext, bindings: ArgBinding[] = []): unknown[] => {
  const args: unknown[] = [];
  for (const binding of bindings) {
    switch (binding.kind) {
      case 'context':
        args[binding.index] = ctx;
        break;
      case 'query':
        args[binding.index] = ctx.query;
        break;
      case 'params':
        args[binding.index] = ctx.params;
        break;
      case 'body':
        args[binding.index] = ctx.body;
        break;
      case 'headers':
        args[binding.index] = ctx.headers;
        break;
      case 'state':
        args[binding.index] = ctx.state;
        break;
      default:
        args[binding.index] = undefined;
        break;
    }
  }
  return args;
};
