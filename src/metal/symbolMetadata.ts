export function ensureSymbolMetadata(): symbol {
  const s = Symbol as unknown as { metadata?: symbol };
  if (!s.metadata) {
    s.metadata = Symbol("Symbol.metadata");
  }
  return s.metadata;
}
