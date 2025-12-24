import { ValidationError } from "./errors.js";
import type { IncludePolicy } from "./metadata.js";

export type IncludeTree = Record<string, IncludeTree>;

function splitPath(token: string): string[] {
  return token.split(".").map(s => s.trim()).filter(Boolean);
}

export function parseInclude(raw: unknown): string[] {
  if (raw == null) return [];
  const items: string[] = [];

  const push = (v: unknown) => {
    if (typeof v !== "string") return;
    for (const part of v.split(",")) {
      const t = part.trim();
      if (t) items.push(t);
    }
  };

  if (Array.isArray(raw)) raw.forEach(push);
  else push(raw);

  const seen = new Set<string>();
  return items.filter(x => (seen.has(x) ? false : (seen.add(x), true)));
}

export function buildIncludeTree(tokens: string[]): IncludeTree {
  const root: IncludeTree = {};
  for (const tok of tokens) {
    const segs = splitPath(tok);
    let node = root;
    for (const s of segs) {
      node[s] ??= {};
      node = node[s]!;
    }
  }
  return root;
}

export function validateInclude(tokens: string[], policy?: IncludePolicy): { tokens: string[]; tree: IncludeTree } {
  if (!tokens.length) return { tokens: [], tree: {} };

  if (!policy) {
    throw new ValidationError("include is not allowed for this route", [
      { source: "include", path: [], message: "include is not allowed" }
    ]);
  }

  const maxDepth = policy.maxDepth ?? 3;
  const allowedRoots = new Set((policy.allowed ?? []).map(s => s.trim()).filter(Boolean));

  for (const tok of tokens) {
    const segs = splitPath(tok);
    if (segs.length === 0) continue;

    if (segs.length > maxDepth) {
      throw new ValidationError("include exceeds maxDepth", [
        { source: "include", path: [tok], message: `maxDepth=${maxDepth}` }
      ]);
    }

    // cycle-ish: forbid repeating a segment within a single path
    const segSet = new Set<string>();
    for (const s of segs) {
      if (segSet.has(s)) {
        throw new ValidationError("include contains a cycle", [
          { source: "include", path: [tok], message: "cycle detected" }
        ]);
      }
      segSet.add(s);
    }

    if (allowedRoots.size > 0) {
      const root = segs[0]!;
      if (!allowedRoots.has(root)) {
        throw new ValidationError("include value not allowed", [
          { source: "include", path: [tok], message: `allowed: ${[...allowedRoots].join(", ")}` }
        ]);
      }
    }
  }

  return { tokens, tree: buildIncludeTree(tokens) };
}
