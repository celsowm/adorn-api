/**
 * Cache schema definition for version 1 of the adorn-api cache format.
 * Stores information about the compilation environment and input files for cache invalidation.
 */
export interface AdornCacheV1 {
  /** Cache format version, always 1 */
  cacheVersion: 1;
  /** Information about the generator that created this cache */
  generator: {
    /** Generator name, always "adorn-api" */
    name: "adorn-api";
    /** Version of the adorn-api package */
    version: string;
    /** Version of TypeScript used during compilation */
    typescript: string;
  };
  /** Information about the TypeScript project configuration */
  project: {
    /** Absolute path to the TypeScript config file */
    tsconfigPath: string;
    /** Map of config file paths to their modification times */
    configFiles: Record<string, number>;
    /** Optional package lockfile information for dependency change detection */
    lockfile?: { path: string; mtimeMs: number } | null;
  };
  /** Map of input file paths to their modification times */
  inputs: Record<string, number>;
}
