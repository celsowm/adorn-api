export function emitVBuilder(node: unknown) {
  return `v.build(${JSON.stringify(node)})`;
}
