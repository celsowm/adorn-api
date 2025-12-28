/**
 * Stage-3 decorators store metadata in a "metadata bag" accessible at runtime via:
 *   MyClass[Symbol.metadata]
 *
 * Some runtimes may not have Symbol.metadata yet; TypeScript's emit still uses it,
 * so we polyfill Symbol.metadata to a stable symbol if missing.
 */
export const SYMBOL_METADATA: symbol = (() => {
  const existing = (Symbol as any).metadata;
  if (typeof existing === 'symbol') return existing;

  const created = Symbol('Symbol.metadata');
  (Symbol as any).metadata = created;
  return created;
})();

/**
 * All adorn-api metadata keys live here.
 * Use Symbol.for so keys stay stable across internal modules/bundles.
 */
export const META = {
  controller: Symbol.for('adorn-api:controller'),
  routes: Symbol.for('adorn-api:routes'),
  db: Symbol.for('adorn-api:db'),
  middleware: Symbol.for('adorn-api:middleware'),
  security: Symbol.for('adorn-api:security'),
  docs: Symbol.for('adorn-api:docs'),
  bindings: Symbol.for('adorn-api:bindings'),
} as const;

/**
 * Minimal shapes for group-1.
 */
export type ControllerMeta = {
  basePath: string;
};

export type RouteMeta = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  name: string;
  options?: unknown;
};

export type DbMeta = {
  transactional: 'auto' | 'required' | 'none';
};

export type BindingHint =
  | { kind: 'path'; name: string; type?: 'string' | 'int' | 'number' | 'boolean' | 'uuid' }
  | { kind: 'query'; name?: string }
  | { kind: 'body' };

export type BindingsMeta = {
  byMethod?: Record<
    string,
    {
      path?: Record<string, 'string' | 'int' | 'number' | 'boolean' | 'uuid'>;
    }
  >;
};
