import type { Guard } from "./metadata.js";

export async function runGuards(guards: Guard[], ctx: unknown) {
  for (const g of guards) await g(ctx);
}