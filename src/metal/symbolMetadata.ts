/**
 * Ensures the Symbol.metadata symbol exists and returns it.
 * Used by Metal ORM decorators to store metadata on classes.
 * 
 * @returns The Symbol.metadata symbol
 */
export function ensureSymbolMetadata(): symbol {
  const s = Symbol as unknown as { metadata?: symbol };
  if (!s.metadata) {
    s.metadata = Symbol("Symbol.metadata");
  }
  return s.metadata;
}
