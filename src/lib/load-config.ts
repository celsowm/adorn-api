// src/lib/load-config.ts
// Configuration loader for adorn-api

import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AdornConfig } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_CONFIG: AdornConfig = {
  tsConfig: "./tsconfig.json",
  controllersGlob: "**/*.controller.ts",
  routesOutput: "./routes.ts",
  basePath: "",
  swaggerOutput: "./swagger.json",
  swaggerInfo: {
    title: "Adorn API",
    version: "1.0.0",
  },
  authMiddlewarePath: "./middleware/auth.middleware.js",
};

export async function loadConfig(configPath?: string): Promise<AdornConfig> {
  // Try to load config file
  const resolvedConfigPath = configPath 
    ? path.resolve(configPath)
    : findConfigFile();

  if (resolvedConfigPath && existsSync(resolvedConfigPath)) {
    try {
      const configModule = await import(resolvedConfigPath);
      const userConfig = configModule.default || configModule;
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (error) {
      console.warn(`Warning: Failed to load config from ${resolvedConfigPath}, using defaults`);
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }

  return DEFAULT_CONFIG;
}

function findConfigFile(): string | null {
  const configNames = [
    "adorn.config.ts",
    "adorn.config.js",
    "adorn.config.mjs",
    "adorn.config.cjs",
  ];

  const cwd = process.cwd();

  for (const name of configNames) {
    const configPath = path.join(cwd, name);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}
