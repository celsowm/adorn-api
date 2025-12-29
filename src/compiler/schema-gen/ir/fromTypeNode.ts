import type { SchemaNode } from './nodes.js';

export function fromTypeNode(name: string): SchemaNode {
  return { kind: 'object', metadata: { name } };
}
