import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { collectTsconfigChain, findLockfile } from "./isStale.js";
import type { AdornCacheV1 } from "./schema.js";

function statMtimeMs(p: string): number {
  return fs.statSync(p).mtimeMs;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function isProjectSourceFile(f: string): boolean {
  if (f.includes(`${path.sep}node_modules${path.sep}`)) return false;
  if (f.includes(`${path.sep}typescript${path.sep}lib${path.sep}`)) return false;
  return /\.(ts|tsx|mts|cts)$/.test(f);
}

export function writeCache(params: {
  outDir: string;
  tsconfigAbs: string;
  program: ts.Program;
  adornVersion: string;
}): void {
  const outDirAbs = path.isAbsolute(params.outDir) ? params.outDir : path.resolve(params.outDir);
  ensureDir(outDirAbs);

  const configFiles = collectTsconfigChain(params.tsconfigAbs);
  const configMtimes: Record<string, number> = {};
  for (const cfg of configFiles) configMtimes[cfg] = statMtimeMs(cfg);

  const lock = findLockfile(path.dirname(params.tsconfigAbs));

  const inputs: Record<string, number> = {};
  for (const sf of params.program.getSourceFiles()) {
    const f = sf.fileName;
    if (!isProjectSourceFile(f)) continue;
    try {
      inputs[f] = statMtimeMs(f);
    } catch {
      // Ignore files that don't exist
    }
  }

  const cache: AdornCacheV1 = {
    cacheVersion: 1,
    generator: {
      name: "adorn-api",
      version: params.adornVersion,
      typescript: ts.version
    },
    project: {
      tsconfigPath: params.tsconfigAbs,
      configFiles: configMtimes,
      lockfile: lock ?? null
    },
    inputs
  };

  fs.writeFileSync(path.join(outDirAbs, "cache.json"), JSON.stringify(cache, null, 2), "utf8");
}
