import type { RouteDefinition } from '../core/metadata/types.js';
import type { ContractRef } from '../contracts/types.js';

export interface HttpContext {
  request: unknown;
  response: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  state: Record<string, unknown>;
  route?: RouteDefinition;
  contract?: ContractRef;
}
