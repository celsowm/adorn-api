// Polyfill Symbol.metadata for environments that don't support it
// Must run before any decorated classes are imported
(Symbol as any).metadata ??= Symbol("Symbol.metadata");

// Export a symbol to prevent tree-shaking
export const ADORN_POLYFILL = Symbol("adorn-polyfill");
