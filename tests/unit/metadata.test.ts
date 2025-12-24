import { describe, it, expect } from 'vitest';
import { ensureDecoratorMetadata } from '../../src/runtime/metadataPolyfill.js';

describe('decorator metadata polyfill', () => {
  it('Symbol.metadata exists', () => {
    ensureDecoratorMetadata();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((Symbol as any).metadata).toBeTruthy();
  });

  it('standard decorator can write to context.metadata', () => {
    ensureDecoratorMetadata();

    const KEY = Symbol('k');

    function Deco() {
      return function (_value: any, context: ClassDecoratorContext) {
        const bag = context.metadata as any;
        bag[KEY] = 123;
      };
    }

    @Deco()
    class A {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md = (A as any)[(Symbol as any).metadata] as any;
    expect(md[KEY]).toBe(123);
  });
});
