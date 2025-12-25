import type { Guard } from './metadata.js';
import type { RequestContext } from './express.js';

export async function runGuards(guards: Guard[], ctx: RequestContext): Promise<void> {
  for (const g of guards) await g(ctx);
}
