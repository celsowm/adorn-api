/**
 * Polyfill for Symbol.metadata in environments that don't natively support it.
 * This polyfill must run before any decorated classes are imported to ensure
 * the metadata API is available for decorator metadata storage.
 * 
 * @remarks
 * This module provides a global polyfill for the `Symbol.metadata` well-known symbol.
 * Some JavaScript environments (like older browsers or non-standard runtimes) may not
 * natively support this symbol, which is required by the adorn-api decorator system.
 * 
 * @example
 * ```typescript
 * // Import this first before any decorated classes
 * import "adorn-api/runtime/polyfill";
 * 
 * // Now decorators can safely use Symbol.metadata
 * @Controller()
 * class MyController { }
 * ```
 * 
 * @package
 */
(Symbol as any).metadata ??= Symbol("Symbol.metadata");

/**
 * Export symbol to prevent tree-shaking of the polyfill module.
 * This ensures the polyfill code is retained in production builds.
 * 
 * @internal
 */
export const ADORN_POLYFILL = Symbol("adorn-polyfill");
