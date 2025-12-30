export interface AdornCacheV1 {
  cacheVersion: 1;
  generator: {
    name: "adorn-api";
    version: string;
    typescript: string;
  };
  project: {
    tsconfigPath: string;
    configFiles: Record<string, number>;
    lockfile?: { path: string; mtimeMs: number } | null;
  };
  inputs: Record<string, number>;
}
