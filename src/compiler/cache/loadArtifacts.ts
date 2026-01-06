import fs from "node:fs";
import path from "node:path";
import { stat } from "node:fs/promises";

interface OpenApi {
  openapi: string;
  components?: {
    schemas?: Record<string, unknown>;
  };
  paths?: Record<string, unknown>;
  info?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
}

interface Manifest {
  manifestVersion: number;
  generatedAt: string;
  generator: {
    name: string;
    version: string;
    typescript: string;
  };
  schemas: {
    kind: string;
    file: string;
    componentsSchemasPointer: string;
  };
  validation: {
    mode: "none" | "ajv-runtime" | "precompiled";
    precompiledModule: string | null;
  };
  controllers: Array<{
    controllerId: string;
    basePath: string;
    operations: Array<{
      operationId: string;
      http: {
        method: string;
        path: string;
      };
      handler: {
        methodName: string;
      };
      args: {
        body: {
          index: number;
          required: boolean;
          contentType: string;
          schemaRef: string;
        } | null;
        path: Array<{
          name: string;
          index: number;
          required: boolean;
          schemaRef: string;
          schemaType?: string | string[];
        }>;
        query: Array<{
          name: string;
          index: number;
          required: boolean;
          schemaRef: string;
          schemaType?: string | string[];
        }>;
        headers: Array<{
          name: string;
          index: number;
          required: boolean;
          schemaRef: string;
          schemaType?: string | string[];
        }>;
        cookies: Array<{
          name: string;
          index: number;
          required: boolean;
          schemaRef: string;
          schemaType?: string | string[];
        }>;
      };
      responses: Array<{
        status: number;
        contentType: string;
        schemaRef: string;
        isArray?: boolean;
      }>;
    }>;
  }>;
}

interface ValidatorModule {
  validators: Record<string, {
    body?: (data: unknown) => boolean;
    response: Record<string, (data: unknown) => boolean>;
  }>;
  validateBody: (operationId: string, data: unknown) => { ok: boolean; errors: unknown[] | null };
  validateResponse: (operationId: string, status: number, contentType: string, data: unknown) => { ok: boolean; errors: unknown[] | null };
}

interface ArtifactCacheEntry {
  openapi: OpenApi | null;
  manifest: Manifest | null;
  validators: ValidatorModule | null;
  mtimes: {
    openapi: number | null;
    manifest: number | null;
    validators: number | null;
  };
}

const artifactCache = new Map<string, ArtifactCacheEntry>();

async function getMtime(filePath: string): Promise<number | null> {
  try {
    const stats = await stat(filePath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}

export interface LoadArtifactsOptions {
  outDir: string;
}

export interface LoadedArtifacts {
  openapi: OpenApi;
  manifest: Manifest;
  validators: ValidatorModule | null;
}

export async function loadArtifacts(options: LoadArtifactsOptions): Promise<LoadedArtifacts> {
  const { outDir } = options;
  const cacheKey = path.resolve(outDir);

  const entry = artifactCache.get(cacheKey);

  const openapiPath = path.join(outDir, "openapi.json");
  const manifestPath = path.join(outDir, "manifest.json");
  const validatorsPath = path.join(outDir, "validators.mjs");

  const openapiMtime = await getMtime(openapiPath);
  const manifestMtime = await getMtime(manifestPath);
  const validatorsMtime = await getMtime(validatorsPath);

  if (entry) {
    const mtimesMatch = 
      entry.mtimes.openapi === openapiMtime &&
      entry.mtimes.manifest === manifestMtime &&
      entry.mtimes.validators === validatorsMtime;

    if (mtimesMatch) {
      if (entry.openapi && entry.manifest) {
        return {
          openapi: entry.openapi,
          manifest: entry.manifest,
          validators: entry.validators,
        };
      }
    }
  }

  const openapiContent = fs.readFileSync(openapiPath, "utf-8");
  const manifestContent = fs.readFileSync(manifestPath, "utf-8");

  const openapi = JSON.parse(openapiContent) as OpenApi;
  const manifest = JSON.parse(manifestContent) as Manifest;

  let validators: ValidatorModule | null = null;

  if (manifest.validation.mode === "precompiled" && manifest.validation.precompiledModule) {
    try {
      const validatorsModule = await import(path.join(outDir, manifest.validation.precompiledModule));
      validators = validatorsModule as ValidatorModule;
    } catch (err) {
      console.warn(`Failed to load precompiled validators: ${err}`);
    }
  }

  artifactCache.set(cacheKey, {
    openapi,
    manifest,
    validators,
    mtimes: {
      openapi: openapiMtime,
      manifest: manifestMtime,
      validators: validatorsMtime,
    },
  });

  return {
    openapi,
    manifest,
    validators,
  };
}

export function clearArtifactCache(outDir?: string): void {
  if (outDir) {
    const cacheKey = path.resolve(outDir);
    artifactCache.delete(cacheKey);
  } else {
    artifactCache.clear();
  }
}

export function getArtifactCacheStats(): { size: number; keys: string[] } {
  return {
    size: artifactCache.size,
    keys: Array.from(artifactCache.keys()),
  };
}
