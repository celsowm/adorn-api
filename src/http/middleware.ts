import type { HttpContext } from './context.js';

export type Middleware = (ctx: HttpContext, next: () => Promise<void>) => Promise<void>;

export const compose = (middleware: Middleware[]) => {
  return async (ctx: HttpContext): Promise<void> => {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;
      const fn = middleware[i];
      if (!fn) return;
      await fn(ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
  };
};
