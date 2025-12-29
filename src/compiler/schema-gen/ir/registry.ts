import type { SchemaNode } from './nodes.js';

const registry: Record<string, SchemaNode> = {};

export function registerSchema(name: string, node: SchemaNode) {
  registry[name] = node;
}

export function getSchema(name: string) {
  return registry[name];
}
