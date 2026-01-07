/**
 * Cache invalidation and staleness detection module.
 * Determines whether the compiled artifacts need to be regenerated based on file changes.
 */
import fs from "node:fs";
import path from "node:path";
import type { AdornCacheV1 } from "./schema.js";

/**
 * Result of a cache staleness check.
 * - stale: false means cache is valid and artifacts can be used as-is
 * - stale: true means cache is invalid and artifacts need to be regenerated
 */
export type StaleResult =
  | { stale: false; reason: "up-to-date" }
  | { stale: true; reason: string; detail?: string };

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function statMtimeMs(p: string): number | null {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

function ensureAbs(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(p);
}

/**
 * Collects all TypeScript config files in the inheritance chain.
 * Follows the "extends" property recursively to build a complete list of config files.
 * 
 * @param tsconfigPathAbs - Absolute path to the root tsconfig.json
 * @returns Array of absolute paths to all config files in the chain, in order from root to leaf
 */
export function collectTsconfigChain(tsconfigPathAbs: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function visit(pAbs: string) {
    if (seen.has(pAbs)) return;
    seen.add(pAbs);
    out.push(pAbs);

    const raw = readJson<any>(pAbs);
    const ext = raw?.extends;
    if (!ext) return;

    let resolved: string | null = null;

    if (ext.startsWith(".") || ext.startsWith("/") || /^[A-Za-z]:\\/.test(ext)) {
      resolved = ensureAbs(path.resolve(path.dirname(pAbs), ext));
      if (!resolved.endsWith(".json")) resolved += ".json";
    } else {
      try {
        const req = (module as any).createRequire?.(import.meta.url) ?? require;
        resolved = req.resolve(ext);
      } catch {
        try {
          const req = (module as any).createRequire?.(import.meta.url) ?? require;
          resolved = req.resolve(ext.endsWith(".json") ? ext : `${ext}.json`);
        } catch {
          resolved = null;
        }
      }
    }

    if (resolved) visit(resolved);
  }

  visit(tsconfigPathAbs);
  return out;
}

/**
 * Searches for a package lockfile (pnpm-lock.yaml, package-lock.json, or yarn.lock)
 * starting from the given directory and moving up the directory tree.
 * 
 * @param startDir - The directory to start searching from
 * @returns Object with path and modification time of the found lockfile, or null if not found
 */
export function findLockfile(startDir: string): { path: string; mtimeMs: number } | null {
  const names = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
  let dir = startDir;

  for (let i = 0; i < 20; i++) {
    for (const n of names) {
      const p = path.join(dir, n);
      const mt = statMtimeMs(p);
      if (mt !== null) return { path: p, mtimeMs: mt };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Determines whether the compiled artifacts are stale and need to be regenerated.
 * Checks the manifest, cache file, TypeScript config files, lockfile, and input files.
 * 
 * @param params - Object containing outDir, project path, adorn version, and TypeScript version
 * @returns Promise resolving to a StaleResult indicating whether regeneration is needed
 */
export async function isStale(params: {
  outDir: string;
  project: string;
  adornVersion: string;
  typescriptVersion: string;
}): Promise<StaleResult> {
  const outDirAbs = ensureAbs(params.outDir);
  const tsconfigAbs = ensureAbs(params.project);

  const manifestPath = path.join(outDirAbs, "manifest.json");
  const cachePath = path.join(outDirAbs, "cache.json");

  if (!fs.existsSync(manifestPath)) return { stale: true, reason: "missing-manifest" };

  const cache = readJson<AdornCacheV1>(cachePath);
  if (!cache) return { stale: true, reason: "missing-cache" };

  if (cache.generator.version !== params.adornVersion) {
    return { stale: true, reason: "generator-version-changed", detail: `${cache.generator.version} -> ${params.adornVersion}` };
  }

  if (ensureAbs(cache.project.tsconfigPath) !== tsconfigAbs) {
    return { stale: true, reason: "tsconfig-changed", detail: "different project path" };
  }

  const chain = collectTsconfigChain(tsconfigAbs);
  for (const cfg of chain) {
    const mt = statMtimeMs(cfg);
    if (mt === null) return { stale: true, reason: "config-missing", detail: cfg };

    const cachedMt = cache.project.configFiles[cfg];
    if (cachedMt === null || Math.abs(cachedMt - mt) > 0.0001) {
      return { stale: true, reason: "config-updated", detail: cfg };
    }
  }

  if (cache.project.lockfile?.path) {
    const mt = statMtimeMs(cache.project.lockfile.path);
    if (mt === null) return { stale: true, reason: "lockfile-missing", detail: cache.project.lockfile.path };

    if (Math.abs(cache.project.lockfile.mtimeMs - mt) > 0.0001) {
      return { stale: true, reason: "lockfile-updated", detail: cache.project.lockfile.path };
    }
  }

  for (const [file, cachedMt] of Object.entries(cache.inputs)) {
    const mt = statMtimeMs(file);
    if (mt === null) return { stale: true, reason: "input-missing", detail: file };
    if (Math.abs(cachedMt - mt) > 0.0001) return { stale: true, reason: "input-updated", detail: file };
  }

  return { stale: false, reason: "up-to-date" };
}
