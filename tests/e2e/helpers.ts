import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "../../src/config/loadConfig";
import { generateRoutes } from "../../src/codegen/generateRoutes";
import { generateOpenapi } from "../../src/openapi/generateOpenapi";

/**
 * Creates a temporary project directory for testing
 * @param prefix - Prefix for the temporary directory name
 * @returns Path to the temporary directory
 */
export async function mkTmpProjectDir(prefix = "adorn-e2e-"): Promise<string> {
  const root = process.cwd();
  const base = path.join(root, ".vitest-tmp");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, prefix));
}

/**
 * Writes a file to the filesystem, creating parent directories if needed
 * @param filePath - Path to the file
 * @param content - Content to write
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Default tsconfig.json content for test projects
 */
export const DEFAULT_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true
    },
    include: ["src/**/*.ts"]
  },
  null,
  2
);

/**
 * Creates a default adorn.config.ts file
 * @param dir - Project directory
 * @param options - Configuration options
 * @returns The config file content
 */
export function createAdornConfig(
  dir: string,
  options: {
    title?: string;
    version?: string;
    description?: string;
    defaultDtoFieldSource?: "smart" | "body" | "query";
  } = {}
): string {
  const {
    title = "E2E Test API",
    version = "1.0.0",
    description,
    defaultDtoFieldSource = "smart"
  } = options;

  const infoSection = `info: { 
    title: "${title}", 
    version: "${version}"${description ? `, description: "${description}"` : ""}
  }`;

  return `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "${defaultDtoFieldSource}",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    ${infoSection}
  }
});
`.trim();
}

/**
 * Sets up a test project with default configuration
 * @param dir - Project directory
 * @param options - Configuration options
 */
export async function setupTestProject(
  dir: string,
  options: {
    title?: string;
    version?: string;
    description?: string;
    defaultDtoFieldSource?: "smart" | "body" | "query";
  } = {}
): Promise<void> {
  await writeFile(path.join(dir, "tsconfig.json"), DEFAULT_TSCONFIG);
  await writeFile(path.join(dir, "adorn.config.ts"), createAdornConfig(dir, options));
}

/**
 * Generates code for the project
 * @param dir - Project directory
 */
export async function generateCode(dir: string): Promise<void> {
  const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });
  await generateRoutes(config);
  await generateOpenapi(config);
}

/**
 * Creates an Express app with generated routes registered
 * @param dir - Project directory
 * @returns Configured Express app
 */
export async function createExpressApp(dir: string): Promise<express.Express> {
  const routesFile = path.join(dir, "src/generated/routes.ts");
  // Bypass ESM cache with a timestamp
  const mod = await import(pathToFileURL(routesFile).href + "?t=" + Date.now());
  const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

  const app = express();
  app.use(express.json());
  RegisterRoutes(app);

  return app;
}

/**
 * Runs a complete test setup: creates project, generates code, and creates Express app
 * @param options - Test setup options
 * @returns Object containing directory, Express app, and cleanup function
 */
export async function setupTestEnvironment(options: {
  prefix?: string;
  title?: string;
  version?: string;
  description?: string;
  defaultDtoFieldSource?: "smart" | "body" | "query";
} = {}): Promise<{
  dir: string;
  app: express.Express;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkTmpProjectDir(options.prefix);
  
  const cleanup = async () => {
    await fs.rm(dir, { recursive: true, force: true });
  };

  try {
    await setupTestProject(dir, options);
    await generateCode(dir);
    const app = await createExpressApp(dir);
    return { dir, app, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Reads the generated OpenAPI JSON file
 * @param dir - Project directory
 * @returns Parsed OpenAPI JSON object
 */
export async function readOpenApiJson(dir: string): Promise<Record<string, any>> {
  const openapiFile = path.join(dir, "src/generated/openapi.json");
  const openapiRaw = await fs.readFile(openapiFile, "utf8");
  return JSON.parse(openapiRaw);
}

/**
 * Safely removes a directory, ignoring errors
 * @param dir - Directory to remove
 */
export async function safeRemoveDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}
